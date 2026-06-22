import { supabase } from './supabase';
import { isSupabaseMissingTableError } from './db-schema';

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
 */
export interface PumpConfig {
  relay_id: number;
  flow_rate_ml_per_second: number;
  pump_type?: string;
}

export function calculateMlDosed(
  durationSeconds: number,
  flowRateMlPerSecond: number = 1.0
): number {
  if (durationSeconds <= 0 || flowRateMlPerSecond <= 0) {
    return 0;
  }
  return Math.round(durationSeconds * flowRateMlPerSecond * 100) / 100;
}

interface RelayCommandHistory {
  relay_number: number;
  action?: string;
  duration_seconds: number | null;
  created_at: string;
  created_by?: string | null;
  target_device_id?: string | null;
  [key: string]: unknown;
}

function relayLabelFromCommand(command: RelayCommandHistory): string {
  const createdBy = command.created_by?.trim();
  if (createdBy && createdBy !== 'web_interface') {
    return createdBy;
  }
  return `Relé ${command.relay_number + 1}`;
}

function isDosageCommand(command: RelayCommandHistory): boolean {
  if (command.action === 'off') return false;
  const duration = command.duration_seconds;
  return duration !== null && duration !== undefined && duration > 0;
}

/**
 * Histórico de comandos — schema prod: public.relay_commands
 */
export async function getRelayCommandsHistory(
  deviceId: string,
  startDate?: Date,
  endDate?: Date,
  relayType: 'local' | 'slave' = 'local'
): Promise<RelayCommandHistory[]> {
  try {
    let query = supabase
      .from('relay_commands')
      .select('*')
      .eq('device_id', deviceId)
      .in('status', ['completed', 'sent'])
      .order('created_at', { ascending: false })
      .limit(1000);

    if (relayType === 'local') {
      query = query.is('target_device_id', null);
    } else {
      query = query.not('target_device_id', 'is', null);
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        console.warn('[analytics] Tabela relay_commands indisponível:', error.message);
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('[analytics] Erro ao buscar relay_commands:', error.message, error.code);
      }
      return [];
    }

    return (data as RelayCommandHistory[]) || [];
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[analytics] Exceção ao buscar histórico:', error);
    }
    return [];
  }
}

export async function calculateDosageMetrics(
  deviceId: string,
  pumpConfigs: PumpConfig[] = [],
  daysBack: number = 7,
  relayType: 'local' | 'slave' = 'local'
): Promise<DosageMetrics[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const commands = await getRelayCommandsHistory(deviceId, startDate, endDate, relayType);
    const dosageCommands = commands.filter(isDosageCommand);

    const relayMap = new Map<
      number,
      {
        relay_id: number;
        relay_name: string;
        activations: RelayCommandHistory[];
        total_duration: number;
      }
    >();

    dosageCommands.forEach((command) => {
      const relayId = command.relay_number;
      const relayName = relayLabelFromCommand(command);

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

    const metrics: DosageMetrics[] = Array.from(relayMap.values()).map((relayData) => {
      const pumpConfig = pumpConfigs.find((p) => p.relay_id === relayData.relay_id);
      const flowRate = pumpConfig?.flow_rate_ml_per_second || 1.0;
      const totalMl = calculateMlDosed(relayData.total_duration, flowRate);

      const lastActivation = relayData.activations.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        relay_id: relayData.relay_id,
        relay_name: relayData.relay_name,
        total_ml_dosed: totalMl,
        total_activations: relayData.activations.length,
        total_duration_seconds: relayData.total_duration,
        average_duration_seconds:
          relayData.activations.length > 0
            ? Math.round(relayData.total_duration / relayData.activations.length)
            : 0,
        last_activation: lastActivation?.created_at,
      };
    });

    return metrics.sort((a, b) => b.total_ml_dosed - a.total_ml_dosed);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[analytics] Erro ao calcular métricas:', error);
    }
    return [];
  }
}

export async function getDeviceAnalytics(
  deviceId: string,
  daysBack: number = 7
): Promise<RelayAnalytics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const emptyResult = (): RelayAnalytics => ({
    device_id: deviceId,
    relay_type: 'local',
    metrics: [],
    total_ml_all_relays: 0,
    period_start: startDate.toISOString(),
    period_end: endDate.toISOString(),
  });

  try {
    const defaultPumpConfigs: PumpConfig[] = [
      { relay_id: 0, flow_rate_ml_per_second: 1.0 },
      { relay_id: 1, flow_rate_ml_per_second: 1.0 },
      { relay_id: 2, flow_rate_ml_per_second: 1.0 },
      { relay_id: 3, flow_rate_ml_per_second: 1.0 },
      { relay_id: 4, flow_rate_ml_per_second: 1.0 },
      { relay_id: 5, flow_rate_ml_per_second: 2.0 },
      { relay_id: 6, flow_rate_ml_per_second: 1.0 },
      { relay_id: 7, flow_rate_ml_per_second: 1.0 },
    ];

    const localMetrics = await calculateDosageMetrics(
      deviceId,
      defaultPumpConfigs,
      daysBack,
      'local'
    );

    const totalMl = localMetrics.reduce((sum, metric) => sum + metric.total_ml_dosed, 0);

    return {
      device_id: deviceId,
      relay_type: 'local',
      metrics: localMetrics,
      total_ml_all_relays: totalMl,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
    };
  } catch {
    return emptyResult();
  }
}
