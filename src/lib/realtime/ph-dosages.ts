import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

  const channelName = `hidrowave-ph-dosages-${deviceId.trim()}`;
  let channel: RealtimeChannel | null = null;

  channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ph_dosages',
        filter: `device_id=eq.${deviceId.trim()}`,
      },
      (payload) => {
        const row = payload.new as PhDosageRow;
        if (row?.device_id) onInsert(row);
      }
    )
    .subscribe();

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}
