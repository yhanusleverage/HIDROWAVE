'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';
import type { DeviceStatus } from '@/lib/automation';
import { resolveDeviceOnline } from '@/lib/realtime/device-status';

const STORAGE_PREFIX = 'hidrowave:activeDevice:';

type ActiveDeviceContextValue = {
  deviceId: string;
  generation: number;
  masters: DeviceStatus[];
  selected: DeviceStatus | undefined;
  setDeviceId: (id: string) => void;
};

const ActiveDeviceContext = createContext<ActiveDeviceContextValue | undefined>(undefined);

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.toLowerCase().trim()}`;
}

function readStoredDeviceId(email: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(storageKey(email))?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeStoredDeviceId(email: string, deviceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(email), deviceId);
  } catch {
    /* quota / private mode */
  }
}

function pickMaster(masters: DeviceStatus[], preferredId: string): string {
  if (preferredId && masters.some((m) => m.device_id === preferredId)) {
    return preferredId;
  }
  const online = masters.find((m) => resolveDeviceOnline(m));
  return online?.device_id || masters[0]?.device_id || '';
}

export function ActiveDeviceProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const email = userProfile?.email?.trim() ?? '';
  const { masters, loading } = useDevicesWithRealtime(email || undefined);
  const [deviceId, setDeviceIdState] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!email) {
      if (deviceId) setGeneration((g) => g + 1);
      setDeviceIdState('');
      return;
    }
    if (loading && masters.length === 0) return;

    const stored = readStoredDeviceId(email);
    const currentOk = Boolean(deviceId) && masters.some((m) => m.device_id === deviceId);
    const next = pickMaster(masters, currentOk ? deviceId : stored);
    if (next === deviceId) {
      if (next) writeStoredDeviceId(email, next);
      return;
    }
    if (deviceId) setGeneration((g) => g + 1);
    if (next) writeStoredDeviceId(email, next);
    setDeviceIdState(next);
  }, [email, loading, masters, deviceId]);

  const setDeviceId = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next || next === deviceId) return;
      if (!masters.some((m) => m.device_id === next)) return;
      if (email) writeStoredDeviceId(email, next);
      setGeneration((g) => g + 1);
      setDeviceIdState(next);
    },
    [deviceId, email, masters]
  );

  const selected = useMemo(
    () => masters.find((m) => m.device_id === deviceId),
    [masters, deviceId]
  );

  const value = useMemo(
    () => ({ deviceId, generation, masters, selected, setDeviceId }),
    [deviceId, generation, masters, selected, setDeviceId]
  );

  return <ActiveDeviceContext.Provider value={value}>{children}</ActiveDeviceContext.Provider>;
}

export function useActiveDevice(): ActiveDeviceContextValue {
  const ctx = useContext(ActiveDeviceContext);
  if (!ctx) {
    throw new Error('useActiveDevice deve ser usado dentro de ActiveDeviceProvider');
  }
  return ctx;
}
