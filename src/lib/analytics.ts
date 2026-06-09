import { supabase } from './supabase';

/**
 * Interface para métricas de dosagem
 */
export interface DosageMetrics {
  relay_id: number;
  relay_name: string;
  total_ml_dosed: number;
  total_activations: number;
  total_duration_seconds: number;
  average_duration_seconds: number;
  last_activation?: string;
}

/**
 * Interface para analytics de relés
 */
export interface RelayAnalytics {
  device_id: string;
  relay_type: 'local' | 'slave';
  slave_mac?: string;
  metrics: DosageMetrics[];
  total_ml_all_relays: number;
  period_start: string;
  period_end: string;
}

/**
 * Configuração de bomba peristáltica para cálculo de ml
 * 
 * Valores padrão (podem ser configurados por relé):
 * - Taxa padrão: 1.0 ml/segundo
 * - Pode variar por tipo de bomba/nutriente
 */
export interface PumpConfig {
  relay_id: number;
  flow_rate_ml_per_second: number; // Taxa de fluxo em ml/segundo
  pump_type?: string; // Tipo de bomba (ex: "peristaltica_12v")
}

/**
 * Calcula ml dosados baseado em duração e taxa de bomba
 * 
 * Fórmula: ml = duração (segundos) × taxa (ml/segundo)
 * 
 * @param durationSeconds Duração em segundos
 * @param flowRateMlPerSecond Taxa de fluxo em ml/segundo (padrão: 1.0)
 * @returns ML dosados
 */
export function calculateMlDosed(
  durationSeconds: number,
  flowRateMlPerSecond: number = 1.0
): number {
  if (durationSeconds <= 0 || flowRateMlPerSecond <= 0) {
    return 0;
  }
  return Math.round(durationSeconds * flowRateMlPerSecond * 100) / 100; // Arredondar para 2 casas
}

/**
 * Interface para comando de relé retornado pelo histórico
 */
interface RelayCommandHistory {
  relay_number: number;
  rule_name?: string;
  duration_seconds: number;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Busca histórico de comandos de relés para analytics
 * 
 * @param deviceId ID do dispositivo (master ou slave MAC)
 * @param startDate Data inicial (opcional)
 * @param endDate Data final (opcional)
 * @param relayType Tipo de relé: 'local' (HydroControl) ou 'slave' (ESP-NOW)
 * @returns Lista de comandos executados
 */
export async function getRelayCommandsHistory(
  deviceId: string,
  startDate?: Date,
  endDate?: Date,
  relayType: 'local' | 'slave' = 'local'
): Promise<RelayCommandHistory[]> {
  try {
    // ✅ CORRIGIDO: Usar tabela correta conforme o tipo
    const tableName = relayType === 'local' ? 'relay_commands_master' : 'relay_commands_slave';
    
    let query = supabase
      .from(tableName)
      .select('*')
      .eq('device_id', deviceId)
      .in('status', ['completed', 'sent']) // ✅ Incluir 'sent' também (comandos executados)
      .order('created_at', { ascending: false })
      .limit(1000); // ✅ Limitar resultados para evitar timeout

    // Filtrar por período se fornecido
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Erro ao buscar histórico de comandos (${tableName}):`, {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        deviceId,
        relayType,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });
      return [];
    }

    if (!data) {
      console.warn(`⚠️ Nenhum dado retornado de ${tableName} para device_id: ${deviceId}`);
      return [];
    }

    return data;
  } catch (error) {
    console.error('❌ Erro ao buscar histórico de comandos (exceção):', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      deviceId,
      relayType
    });
    return [];
  }
}

/**
 * Calcula métricas de dosagem para um dispositivo
 * 
 * Agrupa comandos por relé e calcula:
 * - Total de ml dosados
 * - Número de ativações
 * - Duração total
 * - Média de duração
 * 
 * @param deviceId ID do dispositivo
 * @param pumpConfigs Configurações de bombas (taxa de fluxo por relé)
 * @param daysBack Quantos dias para trás buscar (padrão: 7)
 * @returns Métricas de dosagem por relé
 */
export async function calculateDosageMetrics(
  deviceId: string,
  pumpConfigs: PumpConfig[] = [],
  daysBack: number = 7
): Promise<DosageMetrics[]> {
  try {
    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Buscar histórico de comandos
    const commands = await getRelayCommandsHistory(deviceId, startDate, endDate);

    // Agrupar por relay_number
    const relayMap = new Map<number, {
      relay_id: number;
      relay_name: string;
      activations: RelayCommandHistory[];
      total_duration: number;
    }>();

    commands.forEach((command) => {
      const relayId = command.relay_number;
      const relayName = command.rule_name || `Relé ${relayId + 1}`;

      if (!relayMap.has(relayId)) {
        relayMap.set(relayId, {
          relay_id: relayId,
          relay_name: relayName,
          activations: [],
          total_duration: 0,
        });
      }

      const relayData = relayMap.get(relayId)!;
      relayData.activations.push(command);
      relayData.total_duration += command.duration_seconds || 0;
    });

    // Calcular métricas para cada relé
    const metrics: DosageMetrics[] = Array.from(relayMap.values()).map((relayData) => {
      // Buscar configuração de bomba para este relé
      const pumpConfig = pumpConfigs.find(p => p.relay_id === relayData.relay_id);
      const flowRate = pumpConfig?.flow_rate_ml_per_second || 1.0; // Padrão: 1 ml/segundo

      // Calcular ml dosados
      const totalMl = calculateMlDosed(relayData.total_duration, flowRate);

      // Encontrar última ativação
      const lastActivation = relayData.activations
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      return {
        relay_id: relayData.relay_id,
        relay_name: relayData.relay_name,
        total_ml_dosed: totalMl,
        total_activations: relayData.activations.length,
        total_duration_seconds: relayData.total_duration,
        average_duration_seconds: relayData.activations.length > 0
          ? Math.round(relayData.total_duration / relayData.activations.length)
          : 0,
        last_activation: lastActivation?.created_at,
      };
    });

    // Ordenar por total de ml (maior primeiro)
    return metrics.sort((a, b) => b.total_ml_dosed - a.total_ml_dosed);
  } catch (error) {
    console.error('Erro ao calcular métricas:', error);
    return [];
  }
}

/**
 * Busca analytics completos para um dispositivo
 * 
 * @param deviceId ID do dispositivo master
 * @param daysBack Quantos dias para trás (padrão: 7)
 * @returns Analytics completos
 */
export async function getDeviceAnalytics(
  deviceId: string,
  daysBack: number = 7
): Promise<RelayAnalytics> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Buscar comandos locais (HydroControl)
    const localCommands = await getRelayCommandsHistory(deviceId, startDate, endDate, 'local');
    
    // ✅ Log para debug
    if (localCommands.length === 0) {
      console.log(`ℹ️ Nenhum comando encontrado para device_id: ${deviceId} no período de ${daysBack} dias`);
    } else {
      console.log(`✅ Encontrados ${localCommands.length} comandos para analytics`);
    }
    
    // Configurações padrão de bombas (pode ser carregado do banco depois)
    const defaultPumpConfigs: PumpConfig[] = [
      { relay_id: 0, flow_rate_ml_per_second: 1.0 }, // pH+
      { relay_id: 1, flow_rate_ml_per_second: 1.0 }, // pH-
      { relay_id: 2, flow_rate_ml_per_second: 1.0 }, // Grow
      { relay_id: 3, flow_rate_ml_per_second: 1.0 }, // Micro
      { relay_id: 4, flow_rate_ml_per_second: 1.0 }, // Bloom
      { relay_id: 5, flow_rate_ml_per_second: 2.0 }, // Bomba Principal (maior vazão)
      { relay_id: 6, flow_rate_ml_per_second: 1.0 }, // Luz UV
      { relay_id: 7, flow_rate_ml_per_second: 1.0 }, // Aerador
    ];

    // Calcular métricas locais
    const localMetrics = await calculateDosageMetrics(deviceId, defaultPumpConfigs, daysBack);

    // Calcular total de ml
    const totalMl = localMetrics.reduce((sum, metric) => sum + metric.total_ml_dosed, 0);

    return {
      device_id: deviceId,
      relay_type: 'local',
      metrics: localMetrics,
      total_ml_all_relays: totalMl,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
    };
  } catch (error) {
    console.error('❌ Erro ao buscar analytics:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      deviceId,
      daysBack
    });
    
    // ✅ Retornar estrutura vazia ao invés de lançar erro
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    return {
      device_id: deviceId,
      relay_type: 'local',
      metrics: [],
      total_ml_all_relays: 0,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
    };
  }
}

