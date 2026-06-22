import { supabase } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export type NutrientDosageRow = {
  device_id: string;
  sequence_id: string;
  nutrient_name: string;
  relay_number: number;
  dosage_ml: number;
  dosage_time_seconds: number;
  created_at: string;
};

/**
 * Realtime INSERT em nutrient_dosages (ESP32 → Supabase → UI).
 * Requer replication: ENABLE_REALTIME_REPLICATION.sql ou bloco em CRIAR_TABELA_NUTRIENT_DOSAGES.sql
 */
export function subscribeNutrientDosageInserts(
  deviceId: string,
  onInsert: (row: NutrientDosageRow) => void
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `hidrowave-dosages-${id}`;

  return addSharedChannelListener(channelName, onInsert, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nutrient_dosages',
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as NutrientDosageRow;
          if (!row?.device_id) return;
          listeners.forEach((listener) => listener(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] nutrient_dosages SUBSCRIBED —', id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] nutrient_dosages CHANNEL_ERROR — activar replication');
        }
      })
  );
}
