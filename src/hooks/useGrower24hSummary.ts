import { useCallback, useEffect, useState } from 'react';
import { subscribeNutrientDosageInserts } from '@/lib/realtime/nutrient-dosages';
import { subscribePhDosageInserts } from '@/lib/realtime/ph-dosages';
import {
  fetchEc24hSnapshot,
  fetchPh24hSnapshot,
  type Ec24hSnapshot,
  type Ph24hSnapshot,
} from '@/lib/grower-24h-summary';

const POLL_MS = 60_000;

export function useEc24hSnapshot(deviceId: string, enabled: boolean) {
  const [data, setData] = useState<Ec24hSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchEc24hSnapshot(deviceId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled || !deviceId.trim()) return;

    const pollId = window.setInterval(() => void refresh(), POLL_MS);
    const unsub = subscribeNutrientDosageInserts(deviceId.trim(), () => {
      void refresh();
    });
    return () => {
      window.clearInterval(pollId);
      unsub();
    };
  }, [deviceId, enabled, refresh]);

  return { data, loading };
}

export function usePh24hSnapshot(deviceId: string, enabled: boolean) {
  const [data, setData] = useState<Ph24hSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchPh24hSnapshot(deviceId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled || !deviceId.trim()) return;

    const pollId = window.setInterval(() => void refresh(), POLL_MS);
    const unsub = subscribePhDosageInserts(deviceId.trim(), () => {
      void refresh();
    });
    return () => {
      window.clearInterval(pollId);
      unsub();
    };
  }, [deviceId, enabled, refresh]);

  return { data, loading };
}
