import { trimMetricsRows, METRICS_LIMIT } from '@/lib/controller-metrics-fifo';
import { supabase } from './supabase';
import { isSupabaseMissingTableError } from './db-schema';

export { METRICS_LIMIT };

const METRICS_HOURS = 24;

export type EcControllerMetricRow = {
  id?: number;
  device_id: string;
  ec_setpoint: number;
  ec_actual: number;
  ec_error: number;
  dosage_ml: number;
  dosage_time_seconds?: number;
  adjustment_needed?: boolean;
  adjustment_applied?: boolean;
  created_at: string;
};

export type PhControllerMetricRow = {
  id?: number;
  device_id: string;
  ph_setpoint: number;
  ph_before: number;
  error_h?: number;
  dose_real_ml: number;
  adjustment_needed?: boolean;
  adjustment_applied?: boolean;
  created_at: string;
};

function sinceIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function fetchEcControllerMetrics(
  deviceId: string,
  hours = METRICS_HOURS
): Promise<EcControllerMetricRow[]> {
  try {
    const { data, error } = await supabase
      .from('ec_controller_metrics')
      .select(
        'id, device_id, ec_setpoint, ec_actual, ec_error, dosage_ml, dosage_time_seconds, adjustment_needed, adjustment_applied, created_at'
      )
      .eq('device_id', deviceId)
      .gte('created_at', sinceIso(hours))
      .order('created_at', { ascending: false })
      .limit(METRICS_LIMIT);

    if (error) {
      if (isSupabaseMissingTableError(error)) return [];
      throw error;
    }
    return trimMetricsRows(((data ?? []) as EcControllerMetricRow[]).reverse());
  } catch {
    return [];
  }
}

export async function fetchPhControllerMetrics(
  deviceId: string,
  hours = METRICS_HOURS
): Promise<PhControllerMetricRow[]> {
  try {
    const { data, error } = await supabase
      .from('ph_controller_metrics')
      .select(
        'id, device_id, ph_setpoint, ph_before, error_h, dose_real_ml, adjustment_needed, adjustment_applied, created_at'
      )
      .eq('device_id', deviceId)
      .gte('created_at', sinceIso(hours))
      .order('created_at', { ascending: false })
      .limit(METRICS_LIMIT);

    if (error) {
      if (isSupabaseMissingTableError(error)) return [];
      throw error;
    }
    return trimMetricsRows(((data ?? []) as PhControllerMetricRow[]).reverse());
  } catch {
    return [];
  }
}

export function formatMetricTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
