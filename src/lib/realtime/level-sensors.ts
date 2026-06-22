import { supabase } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export type LevelSensorRow = {
  level_1?: boolean | null;
  level_2?: boolean | null;
  level_3?: boolean | null;
  level_4?: boolean | null;
  water_level?: string | null;
  water_level_ok?: boolean | null;
  updated_at?: string | null;
  last_seen?: string | null;
};

type LevelSensorListener = (row: LevelSensorRow) => void;

export function subscribeLevelSensorUpdates(
  deviceId: string,
  onUpdate: LevelSensorListener
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `level-sensors-${id}`;

  return addSharedChannelListener(channelName, onUpdate, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as LevelSensorRow;
          if (!row) return;
          listeners.forEach((listener) => listener(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] level-sensors SUBSCRIBED —', id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] level-sensors CHANNEL_ERROR');
        }
      })
  );
}
