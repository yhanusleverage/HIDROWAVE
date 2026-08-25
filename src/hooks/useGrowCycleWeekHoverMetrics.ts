'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import {
  emptyWeekHoverStats,
  getWeekHoverRecipe,
  type WeekHoverMetrics,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import {
  fetchWeekHoverStats,
  weekTimeWindow,
} from '@/lib/grow-cycle-timeline/week-hover-summary';
import type { GrowCycleWeeklyStatsRow } from '@/lib/grow-cycle-plans/types';

export function useGrowCycleWeekHoverMetrics(
  plan: GrowCyclePlan,
  hoveredWeek: number | null,
  deviceId: string | null | undefined,
  options?: {
    startedAt?: string | null;
    currentWeekIndex?: number;
    weeklyStats?: GrowCycleWeeklyStatsRow[];
  }
): WeekHoverMetrics | null {
  const activeDeviceId = deviceId?.trim() || '';
  const currentWeekIndex = options?.currentWeekIndex ?? 0;
  const startedAt = options?.startedAt?.trim() || '';
  const weeklyStat = options?.weeklyStats?.find((s) => s.week_index === hoveredWeek) ?? null;

  const [fetched, setFetched] = useState<ReturnType<typeof emptyWeekHoverStats> | null>(null);

  useEffect(() => {
    if (hoveredWeek == null) {
      setFetched(null);
      return;
    }
    const recipe = getWeekHoverRecipe(plan, hoveredWeek, currentWeekIndex);
    if (!recipe || recipe.weekKind === 'future' || !startedAt || !activeDeviceId) {
      setFetched(null);
      return;
    }

    let cancelled = false;
    const { startIso, endIso } = weekTimeWindow(startedAt, hoveredWeek);
    void fetchWeekHoverStats({ deviceId: activeDeviceId, startIso, endIso }).then((stats) => {
      if (!cancelled) setFetched(stats);
    });

    return () => {
      cancelled = true;
    };
  }, [plan, hoveredWeek, currentWeekIndex, startedAt, activeDeviceId]);

  return useMemo(() => {
    if (hoveredWeek == null) return null;
    const recipe = getWeekHoverRecipe(plan, hoveredWeek, currentWeekIndex);
    if (!recipe) return null;
    if (recipe.weekKind === 'future') return recipe;

    const fromFetch = fetched ?? emptyWeekHoverStats();
    const ecAvg =
      fromFetch.ecAvg ??
      (weeklyStat?.ec_avg != null ? Number(weeklyStat.ec_avg) : null);
    const phAvg =
      fromFetch.phAvg ??
      (weeklyStat?.ph_avg != null ? Number(weeklyStat.ph_avg) : null);

    const hasWeekData =
      fromFetch.hasWeekData ||
      ecAvg != null ||
      phAvg != null;

    return {
      ...recipe,
      ...fromFetch,
      ecAvg,
      phAvg,
      hasWeekData,
    };
  }, [plan, hoveredWeek, currentWeekIndex, fetched, weeklyStat]);
}
