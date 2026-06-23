import { isSlaveDeviceType } from '@/lib/db-schema';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  isOnlineFromLastSeen,
  type DeviceStatusRow,
} from '@/lib/realtime/device-status';

/** Fallback REST solo para nombres/metadata (cambian raramente). */
export const SLAVES_METADATA_FALLBACK_MS = 5 * 60 * 1000;

/** Conserva el timestamp más reciente (ISO) para no degradar online tras WSS device_status. */
export function pickNewestTimestamp(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  let best: string | undefined;
  let bestMs = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ms = new Date(candidate).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = candidate;
    }
  }
  return best;
}

/** Slaves ESP-NOW: heartbeat MQTT ~45s — margen 90s (alinhado com firmware link) */
export const SLAVE_ONLINE_THRESHOLD_MINUTES = 1.5;

/**
 * Online unificado para slaves: preferir relay_slaves.last_update, fallback device_status.last_seen.
 * link_online explícito do payload MQTT (quando disponível no row) prevalece.
 */
export function resolveSlaveOnline(
  relaySlavesLastUpdate?: string | null,
  deviceStatusLastSeen?: string | null,
  linkOnline?: boolean | null
): boolean {
  if (linkOnline === true) return true;
  if (linkOnline === false) return false;
  if (
    relaySlavesLastUpdate &&
    isOnlineFromLastSeen(relaySlavesLastUpdate, SLAVE_ONLINE_THRESHOLD_MINUTES)
  ) {
    return true;
  }
  if (
    deviceStatusLastSeen &&
    isOnlineFromLastSeen(deviceStatusLastSeen, SLAVE_ONLINE_THRESHOLD_MINUTES)
  ) {
    return true;
  }
  return false;
}

function normalizeMac(mac: string | null | undefined): string {
  return (mac || '').trim().toUpperCase();
}

export function isSlaveDeviceRow(row: DeviceStatusRow): boolean {
  const id = row.device_id?.toLowerCase() || '';
  const name = row.device_name?.toLowerCase() || '';
  return (
    isSlaveDeviceType(row.device_type) ||
    id.startsWith('esp32_slave_') ||
    name.includes('slave') ||
    name.includes('relaybox')
  );
}

/** Parchea online/last_seen de un slave conocido sin REST completo. */
export function patchSlaveFromDeviceStatus(
  slaves: ESPNowSlave[],
  row: DeviceStatusRow
): { slaves: ESPNowSlave[]; matched: boolean } {
  if (!isSlaveDeviceRow(row)) return { slaves, matched: false };

  let matched = false;

  const updated = slaves.map((slave) => {
    const byId = row.device_id && slave.device_id === row.device_id;
    const byMac =
      row.mac_address &&
      normalizeMac(slave.macAddress) === normalizeMac(row.mac_address);
    if (!byId && !byMac) return slave;

    matched = true;
    const relayLastUpdate = slave.last_seen;
    const deviceLastSeen = row.last_seen ?? null;
    const online = resolveSlaveOnline(relayLastUpdate, deviceLastSeen);
    return {
      ...slave,
      name: row.device_name || slave.name,
      status: online ? ('online' as const) : ('offline' as const),
      last_seen: pickNewestTimestamp(relayLastUpdate, deviceLastSeen) ?? slave.last_seen,
      device_id: row.device_id ?? slave.device_id,
    };
  });

  return { slaves: matched ? updated : slaves, matched };
}
