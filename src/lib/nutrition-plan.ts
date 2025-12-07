/**
 * Funções para gerenciar plano nutricional e mapeamento de relés
 */

import { supabase } from './supabase';

export interface NutrientConfig {
  name: string;
  relayNumber: number;
  mlPerLiter: number;
}

interface NutrientFromSupabase {
  name: string;
  relay_number?: number;
  ml_per_liter?: number;
}

/**
 * Busca nomes de relés LOCAIS do Master de relay_names
 */
export async function getMasterLocalRelayNames(
  masterDeviceId: string
): Promise<Map<number, string>> {
  const relayNamesMap = new Map<number, string>();
  
  if (!masterDeviceId) {
    return relayNamesMap;
  }
  
  try {
    const response = await fetch(`/api/relay-names?device_ids=${encodeURIComponent(masterDeviceId)}`);
    
    if (!response.ok) {
      console.error('Erro ao buscar nomes de relés locais:', response.statusText);
      return relayNamesMap;
    }
    
    const result = await response.json();
    const relayNamesData = result.relay_names || {};
    const deviceRelayNames = relayNamesData[masterDeviceId] || {};
    
    // Converter para Map: relay_number -> relay_name
    Object.keys(deviceRelayNames).forEach((relayNumberStr) => {
      const relayNumber = parseInt(relayNumberStr, 10);
      relayNamesMap.set(relayNumber, deviceRelayNames[relayNumber]);
    });
    
    return relayNamesMap;
  } catch (error) {
    console.error('Erro ao buscar nomes de relés locais:', error);
    return relayNamesMap;
  }
}

/**
 * Salva nome de relé LOCAL do Master em relay_names
 */
export async function saveMasterLocalRelayName(
  masterDeviceId: string,
  relayNumber: number,
  relayName: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('relay_names')
      .upsert(
        {
          device_id: masterDeviceId,
          relay_number: relayNumber,
          relay_name: relayName,
        },
        {
          onConflict: 'device_id,relay_number',
        }
      );
    
    if (error) {
      console.error('Erro ao salvar nome do relé local:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar nome do relé local:', error);
    return false;
  }
}

/**
 * Busca ou cria plano nutricional do Master
 */
export async function getNutritionPlan(
  masterDeviceId: string
): Promise<NutrientConfig[] | null> {
  try {
    const { data, error } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('device_id', masterDeviceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Nenhum plano encontrado - retornar null
        return null;
      }
      console.error('Erro ao buscar plano nutricional:', error);
      return null;
    }
    
    // Converter JSON nutrients para array
    const nutrients = (data.nutrients as NutrientFromSupabase[]) || [];
    return nutrients.map((nut: NutrientFromSupabase) => ({
      name: nut.name,
      relayNumber: nut.relay_number || 0,
      mlPerLiter: nut.ml_per_liter || 0,
    }));
  } catch (error) {
    console.error('Erro ao buscar plano nutricional:', error);
    return null;
  }
}

/**
 * Salva plano nutricional
 */
export async function saveNutritionPlan(
  masterDeviceId: string,
  nutrients: NutrientConfig[],
  pumpFlowRate: number,
  totalVolume: number
): Promise<boolean> {
  try {
    // Converter array para JSON
    const nutrientsJson = nutrients.map(nut => ({
      name: nut.name,
      relay_number: nut.relayNumber,
      ml_per_liter: nut.mlPerLiter,
    }));
    
    // Desativar planos antigos
    await supabase
      .from('nutrition_plans')
      .update({ is_active: false })
      .eq('device_id', masterDeviceId);
    
    // Criar novo plano
    const { error } = await supabase
      .from('nutrition_plans')
      .insert({
        device_id: masterDeviceId,
        plan_name: 'Plano Atual',
        pump_flow_rate: pumpFlowRate,
        total_volume: totalVolume,
        nutrients: nutrientsJson,
        is_active: true,
      });
    
    if (error) {
      console.error('Erro ao salvar plano nutricional:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar plano nutricional:', error);
    return false;
  }
}

