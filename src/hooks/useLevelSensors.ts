'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeLevelSensorUpdates, type LevelSensorRow } from '@/lib/realtime/level-sensors';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';

export type WaterLevelAggregate =
  | 'vazio'
  | 'baixo'
  | 'medio'
  | 'medio_alto'
  | 'alto'
  | null;

export type LevelInterlockMode = 'normal' | 'carrera' | null;

export interface LevelSensorsState {
  level1: boolean | null;
  level2: boolean | null;
  level3: boolean | null;
  level4: boolean | null;
  waterLevel: WaterLevelAggregate;
  waterLevelOk: boolean | null;
  levelInterlockMode: LevelInterlockMode;
  levelsSimulated: boolean;
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
  levelInterlockMode: null,
  levelsSimulated: false,
  lastTelemetryAt: null,
  isLoading: false,
};

function parseWaterLevel(wl: unknown): WaterLevelAggregate {
  if (wl === 'medio_baixo') return 'medio';
  if (
    wl === 'vazio' ||
    wl === 'baixo' ||
    wl === 'medio' ||
    wl === 'medio_alto' ||
    wl === 'alto'
  ) {
    return wl;
  }
  return null;
}

function parseInterlockMode(raw: unknown): LevelInterlockMode {
  if (raw === 'normal' || raw === 'carrera') return raw;
  return null;
}

function parseRow(row: LevelSensorRow | Record<string, unknown> | null): LevelSensorsState {
  if (!row) return { ...EMPTY };
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
  const lastSeen = typeof row.last_seen === 'string' ? row.last_seen : null;
  return {
    level1: typeof row.level_1 === 'boolean' ? row.level_1 : null,
    level2: typeof row.level_2 === 'boolean' ? row.level_2 : null,
    level3: typeof row.level_3 === 'boolean' ? row.level_3 : null,
    level4: typeof row.level_4 === 'boolean' ? row.level_4 : null,
    waterLevel: parseWaterLevel(row.water_level),
    waterLevelOk: typeof row.water_level_ok === 'boolean' ? row.water_level_ok : null,
    levelInterlockMode: parseInterlockMode(row.level_interlock_mode),
    levelsSimulated: row.levels_simulated === true,
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
      .select(
        'level_1, level_2, level_3, level_4, water_level, water_level_ok, level_interlock_mode, levels_simulated, updated_at, last_seen'
      )
      .eq('device_id', id)
      .maybeSingle();

    if (error) {
      console.warn('[useLevelSensors] fetch:', error.message);
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    setState(parseRow(data as LevelSensorRow));
  }, [deviceId, enabled]);

  useEffect(() => {
    setState(EMPTY);
  }, [deviceId]);

  useEffect(() => {
    const id = deviceId?.trim();
    if (!enabled || !id || id === 'default_device') return;

    refresh();

    const unsubscribe = subscribeLevelSensorUpdates(id, (row) => {
      setState(parseRow(row));
    });

    const clearInterval = setVisibleInterval(refresh, FALLBACK_MS);

    return () => {
      unsubscribe();
      clearInterval();
    };
  }, [deviceId, enabled, refresh]);

  return state;
}
