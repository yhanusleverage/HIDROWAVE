'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import {
  getWeekHoverMetricsSimulated,
  type WeekHoverMetrics,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import {
  fetchEcControllerMetrics,
  fetchPhControllerMetrics,
} from '@/lib/controller-metrics';
import { ecErrorAbs } from '@/lib/ec-control-display';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';

export function useGrowCycleWeekHoverMetrics(
  plan: GrowCyclePlan,
  hoveredWeek: number | null,
  deviceId: string | null | undefined
): WeekHoverMetrics | null {
  const activeDeviceId = deviceId?.trim() || '';
  const liveEnabled = Boolean(activeDeviceId && activeDeviceId !== 'default_device');
  const { ec: ecLive, ph: phLive } = useHydroEcReading(
    activeDeviceId,
    liveEnabled && hoveredWeek != null
  );

  const [lastEcDosageMl, setLastEcDosageMl] = useState<number | null>(null);
  const [lastPhDosageMl, setLastPhDosageMl] = useState<number | null>(null);

  useEffect(() => {
    if (!liveEnabled || hoveredWeek == null) {
      setLastEcDosageMl(null);
      setLastPhDosageMl(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const [ecRows, phRows] = await Promise.all([
        fetchEcControllerMetrics(activeDeviceId, 24),
        fetchPhControllerMetrics(activeDeviceId, 24),
      ]);

      if (cancelled) return;

      const lastEc = ecRows.length > 0 ? ecRows[ecRows.length - 1] : null;
      const lastPh = phRows.length > 0 ? phRows[phRows.length - 1] : null;

      setLastEcDosageMl(lastEc?.dosage_ml ?? null);
      setLastPhDosageMl(lastPh?.dose_real_ml ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDeviceId, liveEnabled, hoveredWeek]);

  return useMemo(() => {
    if (hoveredWeek == null) return null;

    const simulated = getWeekHoverMetricsSimulated(plan, hoveredWeek);
    if (!simulated) return null;

    if (!liveEnabled) return simulated;

    const ecActual = ecLive ?? simulated.ecActual;
    const phActual = phLive ?? simulated.phActual;

    return {
      ...simulated,
      ecActual,
      phActual,
      ecError: ecErrorAbs(simulated.ecSetpoint, ecActual),
      phError: Math.abs(phActual - simulated.phSetpoint),
      lastDosageEcMl: lastEcDosageMl ?? simulated.lastDosageEcMl,
      lastDosagePhMl: lastPhDosageMl ?? simulated.lastDosagePhMl,
      source: 'live' as const,
    };
  }, [
    plan,
    hoveredWeek,
    liveEnabled,
    ecLive,
    phLive,
    lastEcDosageMl,
    lastPhDosageMl,
  ]);
}
