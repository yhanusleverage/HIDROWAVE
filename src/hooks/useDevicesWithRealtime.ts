'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUserDevices, type DeviceStatus } from '@/lib/automation';
import {
  subscribeDeviceStatusUpdates,
  isDisplayableMaster,
  resolveDeviceOnline,
  type DeviceStatusRow,
} from '@/lib/realtime/device-status';

const TICK_MS = 30_000;

export function normalizeDeviceOnline(device: DeviceStatus): DeviceStatus {
  return {
    ...device,
    is_online: resolveDeviceOnline(device),
  };
}

function patchFromRow(row: DeviceStatusRow): Partial<DeviceStatus> {
  return {
    last_seen: row.last_seen ?? undefined,
    wifi_rssi: row.wifi_rssi ?? undefined,
    free_heap: row.free_heap ?? undefined,
    uptime_seconds: row.uptime_seconds ?? undefined,
    reboot_count: row.reboot_count ?? undefined,
    firmware_version: row.firmware_version ?? undefined,
    device_name: row.device_name ?? undefined,
    device_type: row.device_type ?? undefined,
    mac_address: row.mac_address ?? undefined,
    ip_address: row.ip_address ?? undefined,
  };
}

export function useDevicesWithRealtime(userEmail: string | undefined) {
  const [rawDevices, setRawDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const loadDevices = useCallback(async () => {
    if (!userEmail) {
      setRawDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getUserDevices(userEmail);
      setRawDevices(list);
    } catch {
      setRawDevices([]);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!userEmail) return;

    return subscribeDeviceStatusUpdates(userEmail, (event) => {
      const { row } = event;
      const patch = patchFromRow(row);

      if (event.type === 'insert' && isDisplayableMaster(row)) {
        const merged = { ...row, ...patch } as DeviceStatus;
        setRawDevices((prev) => {
          if (prev.some((d) => d.device_id === row.device_id)) return prev;
          return [merged, ...prev];
        });
        return;
      }

      setRawDevices((prev) =>
        prev.map((d) => {
          if (d.device_id !== row.device_id) return d;
          const merged = { ...d, ...patch };
          if (row.is_online !== undefined && row.is_online !== null) {
            merged.is_online = row.is_online;
          }
          return merged;
        })
      );
    });
  }, [userEmail]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const devices = useMemo(() => {
    void tick;
    return rawDevices.map(normalizeDeviceOnline);
  }, [rawDevices, tick]);

  const masters = useMemo(() => {
    return devices.filter((device) => {
      const deviceType = device.device_type?.toLowerCase() || '';
      return (
        (deviceType.includes('hydroponic') || deviceType.includes('master')) &&
        !deviceType.includes('slave')
      );
    });
  }, [devices]);

  return { devices, masters, loading, reload: loadDevices };
}
