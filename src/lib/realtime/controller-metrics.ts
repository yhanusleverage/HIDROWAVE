import { supabase } from '@/lib/supabase';
import { METRICS_LIMIT, type EcControllerMetricRow, type PhControllerMetricRow } from '@/lib/controller-metrics';
import type { RealtimeChannel } from '@supabase/supabase-js';

const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;
const METRICS_MAX_ROWS = METRICS_LIMIT;

function trimMetricsRows<T extends { id?: number; created_at?: string }>(rows: T[]): T[] {
  const cutoff = Date.now() - METRICS_WINDOW_MS;
  const filtered = rows.filter((r) => {
    if (!r.created_at) return true;
    const t = new Date(r.created_at).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
  return filtered.slice(-METRICS_MAX_ROWS);
}

function appendMetricRow<T extends { id?: number; created_at?: string }>(
  prev: T[],
  row: T
): T[] {
  if (row.id != null && prev.some((r) => r.id === row.id)) return prev;
  if (
    row.created_at &&
    prev.length > 0 &&
    prev[prev.length - 1].created_at === row.created_at
  ) {
    return prev;
  }
  return trimMetricsRows([...prev, row]);
}

export function subscribeControllerMetrics(
  deviceId: string,
  handlers: {
    onEc?: (row: EcControllerMetricRow) => void;
    onPh?: (row: PhControllerMetricRow) => void;
    onSubscribed?: () => void;
  }
): () => void {
  const channelName = `hidrowave-controller-metrics-${deviceId}`;
  let channel: RealtimeChannel = supabase.channel(channelName);

  if (handlers.onEc) {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ec_controller_metrics',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        const row = payload.new as EcControllerMetricRow;
        if (row) handlers.onEc!(row);
      }
    );
  }

  if (handlers.onPh) {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ph_controller_metrics',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        const row = payload.new as PhControllerMetricRow;
        if (row) handlers.onPh!(row);
      }
    );
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] controller-metrics SUBSCRIBED', deviceId);
      handlers.onSubscribed?.();
    }
    if (status === 'CHANNEL_ERROR') {
      console.warn('[Realtime] controller-metrics CHANNEL_ERROR');
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

export { appendMetricRow, trimMetricsRows, METRICS_MAX_ROWS };
