import { supabase } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export type PhDosageRow = {
  device_id: string;
  sequence_id: string | null;
  direction: 'up' | 'down' | null;
  relay_number: number;
  dosage_ml: number;
  dosage_time_seconds: number;
  ph_before: number | null;
  ph_setpoint: number | null;
  created_at: string;
};

export function subscribePhDosageInserts(
  deviceId: string,
  onInsert: (row: PhDosageRow) => void
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `hidrowave-ph-dosages-${id}`;

  return addSharedChannelListener(channelName, onInsert, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ph_dosages',
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as PhDosageRow;
          if (!row?.device_id) return;
          listeners.forEach((listener) => listener(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ph_dosages SUBSCRIBED —', id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] ph_dosages CHANNEL_ERROR — activar replication');
        }
      })
  );
}
