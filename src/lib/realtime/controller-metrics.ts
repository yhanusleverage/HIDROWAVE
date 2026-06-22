import { supabase } from '@/lib/supabase';
import { METRICS_LIMIT, type EcControllerMetricRow, type PhControllerMetricRow } from '@/lib/controller-metrics';
import { addSharedChannelListener } from '@/lib/realtime/channel';

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

type ControllerMetricsListener = {
  onEc?: (row: EcControllerMetricRow) => void;
  onPh?: (row: PhControllerMetricRow) => void;
  onSubscribed?: () => void;
};

export function subscribeControllerMetrics(
  deviceId: string,
  handlers: ControllerMetricsListener
): () => void {
  if (!deviceId?.trim()) return () => {};

  const channelName = `hidrowave-controller-metrics-${deviceId.trim()}`;

  return addSharedChannelListener(channelName, handlers, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ec_controller_metrics',
          filter: `device_id=eq.${deviceId.trim()}`,
        },
        (payload) => {
          const row = payload.new as EcControllerMetricRow;
          if (!row) return;
          listeners.forEach((listener) => listener.onEc?.(row));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ph_controller_metrics',
          filter: `device_id=eq.${deviceId.trim()}`,
        },
        (payload) => {
          const row = payload.new as PhControllerMetricRow;
          if (!row) return;
          listeners.forEach((listener) => listener.onPh?.(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] controller-metrics SUBSCRIBED', deviceId.trim());
          listeners.forEach((listener) => listener.onSubscribed?.());
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] controller-metrics CHANNEL_ERROR');
        }
      })
  );
}

export { appendMetricRow, trimMetricsRows, METRICS_MAX_ROWS };
