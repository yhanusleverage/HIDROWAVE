import { supabase } from '@/lib/supabase';
import { isMasterDeviceType, isSimulationDevice, isValidMac, normalizeEmail } from '@/lib/db-schema';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type DeviceStatusRow = {
  device_id: string;
  user_email?: string | null;
  last_seen?: string | null;
  is_online?: boolean | null;
  wifi_rssi?: number | null;
  free_heap?: number | null;
  uptime_seconds?: number | null;
  reboot_count?: number | null;
  firmware_version?: string | null;
  mac_address?: string | null;
  device_type?: string | null;
  device_name?: string | null;
};

/** Online se last_seen < 5 min (alinhado com dispositivos/page.tsx) */
export function isOnlineFromLastSeen(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  const minutesAgo = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  return minutesAgo < 5;
}

function belongsToUser(row: DeviceStatusRow, userEmail: string): boolean {
  if (!row.user_email) return false;
  return normalizeEmail(row.user_email) === normalizeEmail(userEmail);
}

function isDisplayableMaster(row: DeviceStatusRow): boolean {
  return (
    isValidMac(row.mac_address) &&
    isMasterDeviceType(row.device_type) &&
    !isSimulationDevice({
      device_id: row.device_id,
      device_name: row.device_name ?? undefined,
      device_type: row.device_type ?? undefined,
    })
  );
}

export type DeviceStatusRealtimeEvent =
  | { type: 'update'; row: DeviceStatusRow }
  | { type: 'insert'; row: DeviceStatusRow };

/**
 * WebSocket Supabase Realtime — browser → Supabase (não passa pelo Next.js).
 * Requer: scripts/ENABLE_REALTIME_REPLICATION.sql (device_status na publication).
 */
export function subscribeDeviceStatusUpdates(
  userEmail: string,
  onEvent: (event: DeviceStatusRealtimeEvent) => void
): () => void {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return () => {};

  const channelName = `hidrowave-device-status-${normalizedEmail.replace(/[^a-z0-9]/g, '-')}`;
  let channel: RealtimeChannel | null = null;

  const handleRow = (row: DeviceStatusRow, type: 'update' | 'insert') => {
    if (!row?.device_id || !belongsToUser(row, normalizedEmail)) return;
    onEvent({ type, row });
  };

  channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_status',
        filter: `user_email=eq.${normalizedEmail}`,
      },
      (payload) => handleRow(payload.new as DeviceStatusRow, 'update')
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_status',
        filter: `user_email=eq.${normalizedEmail}`,
      },
      (payload) => handleRow(payload.new as DeviceStatusRow, 'insert')
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] device_status SUBSCRIBED —', normalizedEmail);
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn(
          '[Realtime] CHANNEL_ERROR device_status — ejecutar scripts/ENABLE_REALTIME_REPLICATION.sql',
          err
        );
      }
      if (status === 'TIMED_OUT') {
        console.warn('[Realtime] device_status TIMED_OUT — reintentando al remontar');
      }
    });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

export { isDisplayableMaster };
