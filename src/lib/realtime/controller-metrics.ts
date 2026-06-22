import { supabase } from '@/lib/supabase';
import type { EcControllerMetricRow, PhControllerMetricRow } from '@/lib/controller-metrics';
import {
  appendMetricRow,
  METRICS_MAX_ROWS,
  trimMetricsRows,
} from '@/lib/controller-metrics-fifo';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export { appendMetricRow, trimMetricsRows, METRICS_MAX_ROWS };
export { sortMetricsByTime } from '@/lib/controller-metrics-fifo';

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
