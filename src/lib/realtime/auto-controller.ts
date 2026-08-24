import { supabase } from '@/lib/supabase';
import {
  addSharedChannelListener,
  type RealtimeChannelStatus,
} from '@/lib/realtime/channel';

export type AutoControllerTable = 'ec_config_view' | 'ph_config_view';

type AutoEnabledListener = {
  onChange: (autoEnabled: boolean) => void;
  onStatus?: (status: RealtimeChannelStatus) => void;
};

/**
 * Realtime de auto_enabled em ec_config_view / ph_config_view.
 * Requer tabela na publication supabase_realtime (ENABLE_REALTIME_REPLICATION.sql).
 */
export function subscribeAutoEnabled(
  deviceId: string,
  table: AutoControllerTable,
  onChange: (autoEnabled: boolean) => void,
  onStatus?: (status: RealtimeChannelStatus) => void
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `hidrowave-auto-${table}-${id}`;
  const listener: AutoEnabledListener = { onChange, onStatus };

  return addSharedChannelListener(channelName, listener, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as { auto_enabled?: boolean } | null;
          if (!row || typeof row.auto_enabled !== 'boolean') return;
          listeners.forEach((l) => l.onChange(row.auto_enabled as boolean));
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
          console.log(`[Realtime] ${table} auto_enabled SUBSCRIBED —`, id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            `[Realtime] ${table} CHANNEL_ERROR — activar replication (ENABLE_REALTIME_REPLICATION.sql)`
          );
        }
        listeners.forEach((l) => l.onStatus?.(mapped));
      })
  );
}
