import { isSlaveDeviceType } from '@/lib/db-schema';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  resolveDeviceOnline,
  type DeviceStatusRow,
} from '@/lib/realtime/device-status';

/** Fallback REST solo para nombres/metadata (cambian raramente). */
export const SLAVES_METADATA_FALLBACK_MS = 5 * 60 * 1000;

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

  const online = resolveDeviceOnline(row);
  let matched = false;

  const updated = slaves.map((slave) => {
    const byId = row.device_id && slave.device_id === row.device_id;
    const byMac = row.mac_address && slave.macAddress === row.mac_address;
    if (!byId && !byMac) return slave;

    matched = true;
    return {
      ...slave,
      name: row.device_name || slave.name,
      status: online ? ('online' as const) : ('offline' as const),
      last_seen: row.last_seen ?? slave.last_seen,
      device_id: row.device_id ?? slave.device_id,
    };
  });

  return { slaves: matched ? updated : slaves, matched };
}
