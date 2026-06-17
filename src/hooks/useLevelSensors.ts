'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';

export type WaterLevelAggregate = 'vazio' | 'baixo' | 'medio' | 'alto' | null;

export interface LevelSensorsState {
  level1: boolean | null;
  level2: boolean | null;
  level3: boolean | null;
  level4: boolean | null;
  waterLevel: WaterLevelAggregate;
  waterLevelOk: boolean | null;
  lastTelemetryAt: string | null;
  isLoading: boolean;
}

const FALLBACK_MS = 30_000;

const EMPTY: LevelSensorsState = {
  level1: null,
  level2: null,
  level3: null,
  level4: null,
  waterLevel: null,
  waterLevelOk: null,
  lastTelemetryAt: null,
  isLoading: false,
};

function parseRow(row: Record<string, unknown> | null): LevelSensorsState {
  if (!row) return { ...EMPTY };
  const wl = row.water_level;
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
  const lastSeen = typeof row.last_seen === 'string' ? row.last_seen : null;
  return {
    level1: typeof row.level_1 === 'boolean' ? row.level_1 : null,
    level2: typeof row.level_2 === 'boolean' ? row.level_2 : null,
    level3: typeof row.level_3 === 'boolean' ? row.level_3 : null,
    level4: typeof row.level_4 === 'boolean' ? row.level_4 : null,
    waterLevel:
      wl === 'vazio' || wl === 'baixo' || wl === 'medio' || wl === 'alto' ? wl : null,
    waterLevelOk: typeof row.water_level_ok === 'boolean' ? row.water_level_ok : null,
    lastTelemetryAt: updatedAt ?? lastSeen,
    isLoading: false,
  };
}

export function useLevelSensors(deviceId: string, enabled = true): LevelSensorsState {
  const [state, setState] = useState<LevelSensorsState>(EMPTY);

  const refresh = useCallback(async () => {
    const id = deviceId?.trim();
    if (!enabled || !id || id === 'default_device') return;

    setState((s) => ({ ...s, isLoading: true }));
    const { data, error } = await supabase
      .from('device_status')
      .select('level_1, level_2, level_3, level_4, water_level, water_level_ok, updated_at, last_seen')
      .eq('device_id', id)
      .maybeSingle();

    if (error) {
      console.warn('[useLevelSensors] fetch:', error.message);
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    setState(parseRow(data as Record<string, unknown>));
  }, [deviceId, enabled]);

  useEffect(() => {
    setState(EMPTY);
  }, [deviceId]);

  useEffect(() => {
    const id = deviceId?.trim();
    if (!enabled || !id || id === 'default_device') return;

    refresh();

    const channel = supabase
      .channel(`level-sensors-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          setState(parseRow(payload.new as Record<string, unknown>));
        }
      )
      .subscribe();

    const clearInterval = setVisibleInterval(refresh, FALLBACK_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval();
    };
  }, [deviceId, enabled, refresh]);

  return state;
}
