/**
 * Alarmes crop_alarms — REST + timers locais para disparo na hora exata.
 * triggered=true no Supabase = já notificado (não repete ao recarregar).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CropAlarm, getCropAlarmTriggerAt, isCropAlarmDue } from '@/lib/crop-calendar';
import { normalizeEmail } from '@/lib/db-schema';

const MAX_NETWORK_FAILURES = 2;
const FETCH_TIMEOUT_MS = 12_000;
/** No primeiro load, ainda mostra toast se o alarme venceu há pouco (app aberto na hora). */
const INITIAL_LOAD_GRACE_MS = 90_000;
/** Poll de segurança — timers locais fazem o disparo exato. */
const BACKUP_POLL_MS = 120_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

interface UseCropAlarmsOptions {
  deviceIds: string[];
  userEmail: string;
  enabled?: boolean;
  checkInterval?: number;
}

interface UseCropAlarmsReturn {
  alarms: CropAlarm[];
  acknowledgedAlarms: Set<string>;
  acknowledgeAlarm: (alarmId: string) => Promise<void>;
  isLoading: boolean;
  available: boolean;
}

function canPoll(deviceIds: string[], userEmail: string, enabled: boolean): boolean {
  if (!enabled || deviceIds.length === 0) return false;
  const email = normalizeEmail(userEmail || '');
  return email.includes('@') && email.length > 3;
}

function buildAlarmsUrl(deviceId: string, userEmail: string): string {
  const params = new URLSearchParams({
    device_id: deviceId.trim(),
    user_email: normalizeEmail(userEmail),
    enabled: 'true',
    acknowledged: 'false',
  });
  return `/api/crop/alarms?${params.toString()}`;
}

function showAlarmToast(alarm: CropAlarm): void {
  const alarmId = String(alarm.id);
  const toastOptions = {
    id: `alarm-${alarmId}`,
    duration: alarm.alarm_type === 'alert' ? 10_000 : 6_000,
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
}

async function markAlarmTriggered(alarmId: string, silent = false): Promise<void> {
  try {
    const response = await fetch('/api/crop/alarms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: alarmId,
        triggered: true,
        triggered_at: new Date().toISOString(),
      }),
    });
    if (!response.ok && !silent && process.env.NODE_ENV === 'development') {
      console.debug('[useCropAlarms] PATCH triggered falhou', alarmId);
    }
  } catch {
    /* não bloqueia UI */
  }
}

function overdueMs(alarm: CropAlarm, now = new Date()): number {
  return now.getTime() - getCropAlarmTriggerAt(alarm).getTime();
}

function shouldNotifyOnInitialLoad(alarm: CropAlarm, now = new Date()): boolean {
  const ms = overdueMs(alarm, now);
  return ms >= 0 && ms <= INITIAL_LOAD_GRACE_MS;
}

export function useCropAlarms({
  deviceIds,
  userEmail,
  enabled = true,
  checkInterval = BACKUP_POLL_MS,
}: UseCropAlarmsOptions): UseCropAlarmsReturn {
  const [alarms, setAlarms] = useState<CropAlarm[]>([]);
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  const wasDueRef = useRef<Map<string, boolean>>(new Map());
  const sessionNotifiedRef = useRef<Set<string>>(new Set());
  const scheduledTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const alarmsByIdRef = useRef<Map<string, CropAlarm>>(new Map());
  const initialSyncDoneRef = useRef(false);
  const networkFailuresRef = useRef(0);
  const pausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const pauseFeature = useCallback((reason: 'schema' | 'network') => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    setAvailable(false);
    setAlarms([]);
    abortRef.current?.abort();
    for (const timer of scheduledTimersRef.current.values()) {
      clearTimeout(timer);
    }
    scheduledTimersRef.current.clear();
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[useCropAlarms] polling pausado (${reason === 'schema' ? 'crop_alarms ausente' : 'rede/API'})`
      );
    }
  }, []);

  const notifyAlarm = useCallback((alarm: CropAlarm) => {
    const alarmId = String(alarm.id);
    if (alarm.triggered || alarm.acknowledged || alarm.enabled === false) return;
    if (sessionNotifiedRef.current.has(alarmId)) return;
    if (!isCropAlarmDue(alarm)) return;

    sessionNotifiedRef.current.add(alarmId);
    showAlarmToast(alarm);
    void markAlarmTriggered(alarmId);

    setAlarms((prev) => {
      const next = prev.map((a) =>
        String(a.id) === alarmId ? { ...a, triggered: true } : a
      );
      return next;
    });
    alarmsByIdRef.current.set(alarmId, { ...alarm, triggered: true });
  }, []);

  const clearScheduledTimer = useCallback((alarmId: string) => {
    const existing = scheduledTimersRef.current.get(alarmId);
    if (existing) {
      clearTimeout(existing);
      scheduledTimersRef.current.delete(alarmId);
    }
  }, []);

  const scheduleFutureAlarm = useCallback(
    (alarm: CropAlarm) => {
      const alarmId = String(alarm.id);
      if (alarm.triggered || alarm.acknowledged || alarm.enabled === false) {
        clearScheduledTimer(alarmId);
        return;
      }

      const delay = getCropAlarmTriggerAt(alarm).getTime() - Date.now();
      if (delay <= 0) return;

      clearScheduledTimer(alarmId);

      const safeDelay = Math.min(delay, MAX_TIMER_DELAY_MS);
      const timer = setTimeout(() => {
        scheduledTimersRef.current.delete(alarmId);
        const latest = alarmsByIdRef.current.get(alarmId);
        if (latest) notifyAlarm(latest);
      }, safeDelay);

      scheduledTimersRef.current.set(alarmId, timer);
    },
    [clearScheduledTimer, notifyAlarm]
  );

  const processAlarms = useCallback(
    (allPending: CropAlarm[], isInitialSync: boolean) => {
      const now = new Date();
      const dueAlarms: CropAlarm[] = [];

      for (const alarm of allPending) {
        const alarmId = String(alarm.id);
        alarmsByIdRef.current.set(alarmId, alarm);
        const due = isCropAlarmDue(alarm, now);
        const wasDue = wasDueRef.current.get(alarmId) ?? false;

        if (due) {
          dueAlarms.push(alarm);
        }

        if (!alarm.triggered && !alarm.acknowledged && alarm.enabled !== false) {
          if (due) {
            if (isInitialSync) {
              if (shouldNotifyOnInitialLoad(alarm, now)) {
                notifyAlarm(alarm);
              } else {
                void markAlarmTriggered(alarmId, true);
                alarmsByIdRef.current.set(alarmId, { ...alarm, triggered: true });
              }
            } else if (!wasDue) {
              notifyAlarm(alarm);
            }
          } else {
            scheduleFutureAlarm(alarm);
          }
        } else {
          clearScheduledTimer(alarmId);
        }

        wasDueRef.current.set(alarmId, due);
      }

      setAlarms(dueAlarms.filter((a) => !a.acknowledged));
    },
    [clearScheduledTimer, notifyAlarm, scheduleFutureAlarm]
  );

  const fetchAlarms = useCallback(async () => {
    if (pausedRef.current || !canPoll(deviceIds, userEmail, enabled)) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const isInitialSync = !initialSyncDoneRef.current;

    try {
      setIsLoading(true);

      const responses = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const response = await fetch(buildAlarmsUrl(deviceId, userEmail), {
            signal: controller.signal,
            cache: 'no-store',
          });
          return { deviceId, response };
        })
      );

      for (const { response } of responses) {
        if (response.status === 503) {
          pauseFeature('schema');
          return;
        }
      }

      const failed = responses.some(
        (r) => !r.response.ok && r.response.status !== 400
      );
      if (failed) {
        networkFailuresRef.current += 1;
        if (networkFailuresRef.current >= MAX_NETWORK_FAILURES) {
          pauseFeature('network');
        }
        return;
      }

      networkFailuresRef.current = 0;

      const merged: CropAlarm[] = [];
      for (const { response } of responses) {
        if (!response.ok) continue;
        const data = await response.json().catch(() => null);
        if (!data || data.table_available === false) {
          pauseFeature('schema');
          return;
        }
        merged.push(...(data.alarms || []));
      }

      processAlarms(merged, isInitialSync);
      initialSyncDoneRef.current = true;
    } catch {
      if (!controller.signal.aborted) {
        networkFailuresRef.current += 1;
        if (networkFailuresRef.current >= MAX_NETWORK_FAILURES) {
          pauseFeature('network');
        }
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [deviceIds, userEmail, enabled, pauseFeature, processAlarms]);

  const acknowledgeAlarm = useCallback(
    async (alarmId: string) => {
      if (pausedRef.current || !available) return;

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
        if (!response.ok) return;

        clearScheduledTimer(alarmId);
        setAcknowledgedAlarms((prev) => new Set(prev).add(alarmId));
        setAlarms((prev) => prev.filter((alarm) => String(alarm.id) !== alarmId));
        alarmsByIdRef.current.delete(alarmId);
        toast.success('Alarme marcado como lido');
      } catch {
        /* silencioso */
      }
    },
    [available, pauseFeature, clearScheduledTimer]
  );

  const deviceKey = deviceIds.join('|');

  useEffect(() => {
    pausedRef.current = false;
    networkFailuresRef.current = 0;
    initialSyncDoneRef.current = false;
    wasDueRef.current = new Map();
    sessionNotifiedRef.current = new Set();
    alarmsByIdRef.current = new Map();
    for (const timer of scheduledTimersRef.current.values()) {
      clearTimeout(timer);
    }
    scheduledTimersRef.current.clear();
    setAvailable(true);
    setAlarms([]);
  }, [deviceKey, userEmail]);

  useEffect(() => {
    if (!canPoll(deviceIds, userEmail, enabled) || pausedRef.current) {
      return;
    }

    fetchAlarms();
    const interval = setInterval(fetchAlarms, checkInterval);
    const timersAtMount = scheduledTimersRef;

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
      for (const timer of timersAtMount.current.values()) {
        clearTimeout(timer);
      }
      timersAtMount.current.clear();
    };
  }, [deviceIds, userEmail, enabled, checkInterval, fetchAlarms, deviceKey]);

  return {
    alarms,
    acknowledgedAlarms,
    acknowledgeAlarm,
    isLoading,
    available,
  };
}
