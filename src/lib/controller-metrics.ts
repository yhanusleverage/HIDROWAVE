import { supabase } from './supabase';
import { isSupabaseMissingTableError } from './db-schema';

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

const METRICS_LIMIT = 120;
const METRICS_HOURS = 24;

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
        'device_id, ec_setpoint, ec_actual, ec_error, dosage_ml, dosage_time_seconds, adjustment_needed, adjustment_applied, created_at'
      )
      .eq('device_id', deviceId)
      .gte('created_at', sinceIso(hours))
      .order('created_at', { ascending: true })
      .limit(METRICS_LIMIT);

    if (error) {
      if (isSupabaseMissingTableError(error)) return [];
      throw error;
    }
    return (data ?? []) as EcControllerMetricRow[];
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
        'device_id, ph_setpoint, ph_before, error_h, dose_real_ml, adjustment_needed, adjustment_applied, created_at'
      )
      .eq('device_id', deviceId)
      .gte('created_at', sinceIso(hours))
      .order('created_at', { ascending: true })
      .limit(METRICS_LIMIT);

    if (error) {
      if (isSupabaseMissingTableError(error)) return [];
      throw error;
    }
    return (data ?? []) as PhControllerMetricRow[];
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
