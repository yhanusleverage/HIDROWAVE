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
  ip_address?: string | null;
  level_1?: boolean | null;
  level_2?: boolean | null;
  level_3?: boolean | null;
  level_4?: boolean | null;
  water_level?: string | null;
  water_level_ok?: boolean | null;
};

/** Heartbeat MQTT ~60s + HTTPS status 60s — margem 5 min (evita falso offline en UI) */
export const ONLINE_THRESHOLD_MINUTES = 5;

/** Online pero last_seen > 1 min → aviso de latência */
export const ONLINE_WARNING_MINUTES = 1;

export function minutesSinceLastSeen(lastSeen: string | null | undefined): number | null {
  if (!lastSeen) return null;
  return (Date.now() - new Date(lastSeen).getTime()) / 60000;
}

export function isOnlineFromLastSeen(
  lastSeen: string | null | undefined,
  thresholdMinutes = ONLINE_THRESHOLD_MINUTES
): boolean {
  const minutes = minutesSinceLastSeen(lastSeen);
  if (minutes === null) return false;
  return minutes < thresholdMinutes;
}

/**
 * Regla única:
 * - last_seen fresco → online (prevalece sobre is_online=false stale del bridge)
 * - is_online=false + last_seen viejo → offline
 * - sin last_seen → offline
 */
export function resolveDeviceOnline(row: {
  last_seen?: string | null;
  is_online?: boolean | null;
}): boolean {
  if (row.last_seen && isOnlineFromLastSeen(row.last_seen)) {
    return true;
  }
  if (row.is_online === false) return false;
  if (!row.last_seen) return false;
  return isOnlineFromLastSeen(row.last_seen);
}

export type DeviceDisplayStatus = 'online' | 'offline' | 'warning';

export function getDeviceDisplayStatus(row: {
  last_seen?: string | null;
  is_online?: boolean | null;
}): DeviceDisplayStatus {
  if (!resolveDeviceOnline(row)) return 'offline';
  const minutes = minutesSinceLastSeen(row.last_seen);
  if (minutes !== null && minutes > ONLINE_WARNING_MINUTES) return 'warning';
  return 'online';
}

export function getDeviceStatusText(status: DeviceDisplayStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'warning':
      return 'Aviso';
  }
}

export function getLastSeenText(lastSeen: string | null | undefined): string {
  if (!lastSeen) return 'Nunca conectado';
  const minutesAgo = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (minutesAgo < 1) return 'Agora';
  if (minutesAgo < 60) return `Há ${minutesAgo} min`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `Há ${hoursAgo}h`;
  return `Há ${Math.floor(hoursAgo / 24)} dias`;
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

export type DeviceStatusChannelStatus =
  | 'SUBSCRIBED'
  | 'CHANNEL_ERROR'
  | 'TIMED_OUT'
  | 'CLOSED';

/**
 * WebSocket Supabase Realtime — browser → Supabase (não passa pelo Next.js).
 * Requer: scripts/ENABLE_REALTIME_REPLICATION.sql (device_status na publication).
 */
export function subscribeDeviceStatusUpdates(
  userEmail: string,
  onEvent: (event: DeviceStatusRealtimeEvent) => void,
  onChannelStatus?: (status: DeviceStatusChannelStatus) => void
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
        onChannelStatus?.('SUBSCRIBED');
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn(
          '[Realtime] CHANNEL_ERROR device_status — ejecutar scripts/ENABLE_REALTIME_REPLICATION.sql',
          err
        );
        onChannelStatus?.('CHANNEL_ERROR');
      }
      if (status === 'TIMED_OUT') {
        console.warn('[Realtime] device_status TIMED_OUT — reconectando');
        onChannelStatus?.('TIMED_OUT');
      }
      if (status === 'CLOSED') {
        onChannelStatus?.('CLOSED');
      }
    });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

export { isDisplayableMaster };

