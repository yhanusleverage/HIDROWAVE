/**
 * Hook opcional — recordatorios crop_alarms (calendario humano).
 * Si la tabla no existe en Supabase (503 / table_available:false), deja de hacer poll
 * sin errores en UI ni spam en consola. No bloquea el dashboard.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CropAlarm } from '@/lib/crop-calendar';
import { normalizeEmail } from '@/lib/db-schema';

const MAX_NETWORK_FAILURES = 2;
const FETCH_TIMEOUT_MS = 12_000;

interface UseCropAlarmsOptions {
  deviceId: string;
  userEmail: string;
  enabled?: boolean;
  checkInterval?: number;
}

interface UseCropAlarmsReturn {
  alarms: CropAlarm[];
  acknowledgedAlarms: Set<string>;
  acknowledgeAlarm: (alarmId: string) => Promise<void>;
  isLoading: boolean;
  /** false cuando crop_alarms no está migrada o el feature se pausó */
  available: boolean;
}

function canPoll(deviceId: string, userEmail: string, enabled: boolean): boolean {
  if (!enabled || !deviceId?.trim()) return false;
  const email = normalizeEmail(userEmail || '');
  return email.includes('@') && email.length > 3;
}

function buildAlarmsUrl(deviceId: string, userEmail: string): string {
  const params = new URLSearchParams({
    device_id: deviceId.trim(),
    user_email: normalizeEmail(userEmail),
    triggered: 'true',
    acknowledged: 'false',
  });
  return `/api/crop/alarms?${params.toString()}`;
}

export function useCropAlarms({
  deviceId,
  userEmail,
  enabled = true,
  checkInterval = 60_000,
}: UseCropAlarmsOptions): UseCropAlarmsReturn {
  const [alarms, setAlarms] = useState<CropAlarm[]>([]);
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  const lastShownRef = useRef<Set<string>>(new Set());
  const networkFailuresRef = useRef(0);
  const pausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const pauseFeature = useCallback((reason: 'schema' | 'network') => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setAvailable(false);
    setAlarms([]);
    abortRef.current?.abort();
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[useCropAlarms] polling pausado (${reason === 'schema' ? 'crop_alarms ausente' : 'rede/API'})`
      );
    }
  }, []);

  const fetchAlarms = useCallback(async () => {
    if (pausedRef.current || !canPoll(deviceId, userEmail, enabled)) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      setIsLoading(true);

      const response = await fetch(buildAlarmsUrl(deviceId, userEmail), {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status === 503) {
        pauseFeature('schema');
        return;
      }

      if (!response.ok) {
        if (response.status === 400) {
          return;
        }
        networkFailuresRef.current += 1;
        if (networkFailuresRef.current >= MAX_NETWORK_FAILURES) {
          pauseFeature('network');
        }
        return;
      }

      networkFailuresRef.current = 0;

      const data = await response.json().catch(() => null);
      if (!data || data.table_available === false) {
        pauseFeature('schema');
        return;
      }

      const triggeredAlarms: CropAlarm[] = data.alarms || [];

      const newAlarms = triggeredAlarms.filter(
        (alarm) => !lastShownRef.current.has(String(alarm.id))
      );

      newAlarms.forEach((alarm) => {
        const alarmId = String(alarm.id);
        lastShownRef.current.add(alarmId);

        const toastOptions = {
          id: `alarm-${alarmId}`,
          duration: alarm.alarm_type === 'alert' ? 10_000 : 5_000,
        };

        const message = alarm.description
          ? `${alarm.title}\n${alarm.description}`
          : alarm.title;

        switch (alarm.alarm_type) {
          case 'alert':
            toast.error(message, { ...toastOptions, icon: '⚠️' });
            break;
          case 'notification':
            toast(message, { ...toastOptions, icon: 'ℹ️' });
            break;
          case 'reminder':
          default:
            toast.success(message, { ...toastOptions, icon: '🔔' });
            break;
        }
      });

      setAlarms(triggeredAlarms);
    } catch (error) {
      if (controller.signal.aborted) {
        networkFailuresRef.current += 1;
        if (networkFailuresRef.current >= MAX_NETWORK_FAILURES) {
          pauseFeature('network');
        }
        return;
      }
      networkFailuresRef.current += 1;
      if (networkFailuresRef.current >= MAX_NETWORK_FAILURES) {
        pauseFeature('network');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [deviceId, userEmail, enabled, pauseFeature]);

  const acknowledgeAlarm = useCallback(
    async (alarmId: string) => {
      if (pausedRef.current || !available) {
        return;
      }

      try {
        const response = await fetch('/api/crop/alarms', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: alarmId, acknowledged: true }),
        });

        if (response.status === 503) {
          pauseFeature('schema');
          return;
        }

        if (!response.ok) {
          return;
        }

        setAcknowledgedAlarms((prev) => new Set(prev).add(alarmId));
        setAlarms((prev) => prev.filter((alarm) => String(alarm.id) !== alarmId));
        toast.success('Alarme marcado como lido');
      } catch {
        /* silencioso — calendário opcional */
      }
    },
    [available, pauseFeature]
  );

  useEffect(() => {
    pausedRef.current = false;
    networkFailuresRef.current = 0;
    lastShownRef.current = new Set();
    setAvailable(true);
    setAlarms([]);
  }, [deviceId, userEmail]);

  useEffect(() => {
    if (!canPoll(deviceId, userEmail, enabled) || pausedRef.current) {
      return;
    }

    fetchAlarms();
    const interval = setInterval(fetchAlarms, checkInterval);

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [deviceId, userEmail, enabled, checkInterval, fetchAlarms]);

  return {
    alarms,
    acknowledgedAlarms,
    acknowledgeAlarm,
    isLoading,
    available,
  };
};
