/**
 * API para buscar estados de relés usando relay_slaves (não relay_states)
 * 
 * Estratégia correta:
 * - relay_master = Estados dos relés LOCAIS (arrays)
 * - relay_slaves = Estados dos relés SLAVES (arrays)
 * - relay_names = Nomes personalizados
 */

import { supabase } from './supabase';

export interface SlaveRelayState {
  device_id: string;
  relay_number: number;
  state: boolean;
  has_timer: boolean;
  remaining_time: number;
}

/**
 * Busca estados dos relés de slaves usando relay_slaves
 * 
 * @param masterDeviceId ID do Master
 * @param slaveDeviceIds Array de device_ids dos slaves (opcional)
 * @returns Map de device_id -> relay_number -> estado
 */
export async function getSlaveRelayStates(
  masterDeviceId: string,
  slaveDeviceIds?: string[]
): Promise<Map<string, SlaveRelayState[]>> {
  const relayStatesMap = new Map<string, SlaveRelayState[]>();
  
  try {
    let query = supabase
      .from('relay_slaves')
      .select('device_id, relay_states, relay_has_timers, relay_remaining_times')
      .eq('master_device_id', masterDeviceId);
    
    // Filtrar por device_ids se fornecido
    if (slaveDeviceIds && slaveDeviceIds.length > 0) {
      query = query.in('device_id', slaveDeviceIds);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao buscar estados de relés de slaves:', error);
      return relayStatesMap;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ Nenhum slave encontrado em relay_slaves');
      return relayStatesMap;
    }
    
    // Converter arrays em objetos individuais por relé
    data.forEach((slave: any) => {
      const relayStates: SlaveRelayState[] = [];
      
      // Arrays: relay_states[], relay_has_timers[], relay_remaining_times[]
      const states = slave.relay_states || Array(8).fill(false);
      const hasTimers = slave.relay_has_timers || Array(8).fill(false);
      const remainingTimes = slave.relay_remaining_times || Array(8).fill(0);
      
      // Criar objeto para cada relé (0-7)
      for (let i = 0; i < 8; i++) {
        relayStates.push({
          device_id: slave.device_id,
          relay_number: i,
          state: states[i] || false,
          has_timer: hasTimers[i] || false,
          remaining_time: remainingTimes[i] || 0,
        });
      }
      
      relayStatesMap.set(slave.device_id, relayStates);
    });
    
    console.log(`✅ Estados de ${data.length} slave(s) encontrado(s) em relay_slaves`);
    return relayStatesMap;
  } catch (error) {
    console.error('❌ Erro ao buscar estados de relés de slaves:', error);
    return relayStatesMap;
  }
}

/**
 * Busca estados dos relés LOCAIS do Master usando relay_master
 * 
 * @param masterDeviceId ID do Master
 * @returns Objeto com arrays de estados dos relés locais
 */
export async function getMasterLocalRelayStates(masterDeviceId: string): Promise<{
  doser_relay_states: boolean[];
  doser_relay_has_timers: boolean[];
  doser_relay_remaining_times: number[];
  level_relay_states: boolean[];
  level_relay_has_timers: boolean[];
  level_relay_remaining_times: number[];
  reserved_relay_states: boolean[];
  reserved_relay_has_timers: boolean[];
  reserved_relay_remaining_times: number[];
} | null> {
  try {
    const { data, error } = await supabase
      .from('relay_master')
      .select('*')
      .eq('device_id', masterDeviceId)
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar estados de relés locais:', error);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    return {
      doser_relay_states: data.doser_relay_states || Array(8).fill(false),
      doser_relay_has_timers: data.doser_relay_has_timers || Array(8).fill(false),
      doser_relay_remaining_times: data.doser_relay_remaining_times || Array(8).fill(0),
      level_relay_states: data.level_relay_states || Array(4).fill(false),
      level_relay_has_timers: data.level_relay_has_timers || Array(4).fill(false),
      level_relay_remaining_times: data.level_relay_remaining_times || Array(4).fill(0),
      reserved_relay_states: data.reserved_relay_states || Array(4).fill(false),
      reserved_relay_has_timers: data.reserved_relay_has_timers || Array(4).fill(false),
      reserved_relay_remaining_times: data.reserved_relay_remaining_times || Array(4).fill(0),
    };
  } catch (error) {
    console.error('❌ Erro ao buscar estados de relés locais:', error);
    return null;
  }
}

