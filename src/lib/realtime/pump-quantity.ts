import { supabase } from '@/lib/supabase';
import {
  addSharedChannelListener,
  type RealtimeChannelStatus,
} from '@/lib/realtime/channel';

export type PumpQuantityRow = {
  device_id: string;
  relay_index: number;
  role: string;
  total_ml: number;
  last_increment_at: string | null;
  last_reset_at: string | null;
  updated_at: string;
};

type PumpQuantityListener = {
  onChange: (row: PumpQuantityRow) => void;
  onStatus?: (status: RealtimeChannelStatus) => void;
};

/**
 * Realtime INSERT/UPDATE/DELETE en pump_quantity.
 * Requiere: scripts/ENABLE_PUMP_QUANTITY_REALTIME.sql (o ENABLE_REALTIME_REPLICATION.sql).
 */
export function subscribePumpQuantity(
  deviceId: string,
  onChange: (row: PumpQuantityRow) => void,
  onStatus?: (status: RealtimeChannelStatus) => void
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `hidrowave-pump-qty-${id}`;
  const listener: PumpQuantityListener = { onChange, onStatus };

  return addSharedChannelListener(channelName, listener, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pump_quantity',
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as PumpQuantityRow;
          if (!row?.device_id) return;
          listeners.forEach((l) => l.onChange(row));
        }
      )
      .subscribe((status) => {
        const mapped: RealtimeChannelStatus =
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
            ? status
            : 'CLOSED';

        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] pump_quantity SUBSCRIBED —', id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            '[Realtime] pump_quantity CHANNEL_ERROR — ejecutar ENABLE_PUMP_QUANTITY_REALTIME.sql'
          );
        }

        listeners.forEach((l) => l.onStatus?.(mapped));
      })
  );
}
