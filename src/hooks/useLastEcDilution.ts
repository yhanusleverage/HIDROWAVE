/**
 * Último evento em ec_dilution_events.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const POLL_MS = 30_000;
const TABLE_MISSING = '42P01';

export interface LastEcDilutionResult {
  volumeMeasuredL: number | null;
  volumeTargetL: number | null;
  source: string | null;
  completedAt: string | null;
  isLoading: boolean;
  available: boolean;
}

export function useLastEcDilution(deviceId: string, enabled = true): LastEcDilutionResult {
  const [volumeMeasuredL, setVolumeMeasuredL] = useState<number | null>(null);
  const [volumeTargetL, setVolumeTargetL] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('ec_dilution_events')
      .select('volume_measured_l, volume_target_l, source, created_at')
      .eq('device_id', deviceId.trim())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      if (error.code === TABLE_MISSING) {
        setAvailable(false);
      }
      setIsLoading(false);
      return;
    }

    if (!data?.length) {
      setVolumeMeasuredL(null);
      setVolumeTargetL(null);
      setSource(null);
      setCompletedAt(null);
      setIsLoading(false);
      return;
    }

    const row = data[0];
    setVolumeMeasuredL(Number(row.volume_measured_l) || null);
    setVolumeTargetL(Number(row.volume_target_l) || null);
    setSource((row.source as string) || null);
    setCompletedAt((row.created_at as string) || null);
    setIsLoading(false);
  }, [deviceId, enabled]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [deviceId, enabled, refresh]);

  return {
    volumeMeasuredL,
    volumeTargetL,
    source,
    completedAt,
    isLoading,
    available,
  };
}
