import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DeviceStatusRow = {
  device_id: string;
  last_seen?: string | null;
  is_online?: boolean | null;
  wifi_rssi?: number | null;
  free_heap?: number | null;
  uptime_seconds?: number | null;
  reboot_count?: number | null;
  firmware_version?: string | null;
};

/** Online se last_seen < 5 min (alinhado com dispositivos/page.tsx) */
export function isOnlineFromLastSeen(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  const minutesAgo = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  return minutesAgo < 5;
}

/**
 * WebSocket Supabase Realtime — browser → Supabase (não passa pelo Next.js).
 * Funciona em Railway, Vercel e local.
 * Requer: Replication activa em device_status no dashboard Supabase.
 */
export function subscribeDeviceStatusUpdates(
  onUpdate: (row: DeviceStatusRow) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  channel = supabase
    .channel('hidrowave-device-status')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'device_status' },
      (payload) => {
        const row = payload.new as DeviceStatusRow;
        if (row?.device_id) {
          onUpdate(row);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'device_status' },
      (payload) => {
        const row = payload.new as DeviceStatusRow;
        if (row?.device_id) {
          onUpdate(row);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] WebSocket device_status activo');
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn(
          '[Realtime] Erro no canal — activar Replication em device_status no Supabase'
        );
      }
    });

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}
