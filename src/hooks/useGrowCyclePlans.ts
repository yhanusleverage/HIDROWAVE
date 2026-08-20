'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import type { GrowCycleInstanceRow, GrowCyclePlanRow, GrowCycleWeeklyStatsRow } from '@/lib/grow-cycle-plans/types';

export function useGrowCyclePlans(deviceId: string | null) {
  const [plans, setPlans] = useState<GrowCyclePlanRow[]>([]);
  const [activeInstance, setActiveInstance] = useState<GrowCycleInstanceRow | null>(null);
  const [tableAvailable, setTableAvailable] = useState(true);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!deviceId?.trim()) {
      setPlans([]);
      setActiveInstance(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/grow-cycle/plans?device_id=${encodeURIComponent(deviceId)}`);
      const data = await res.json();
      if (res.ok) {
        setPlans(data.plans ?? []);
        setActiveInstance(data.active_instance ?? null);
        setTableAvailable(data.table_available !== false);
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePlan = useCallback(
    async (plan: GrowCyclePlan, name?: string) => {
      if (!deviceId?.trim()) return { ok: false as const, error: 'device_id ausente' };
      const res = await fetch('/api/grow-cycle/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          plan_json: plan,
          name: name ?? plan.name,
          status: 'draft',
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false as const, error: data.error ?? 'Erro ao guardar' };
      await refresh();
      return { ok: true as const, plan: data.plan as GrowCyclePlanRow };
    },
    [deviceId, refresh]
  );

  const publishPlan = useCallback(
    async (plan: GrowCyclePlan, planRowId?: string, createdBy?: string) => {
      if (!deviceId?.trim()) return { ok: false as const, error: 'device_id ausente' };
      const res = await fetch('/api/grow-cycle/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          plan,
          plan_id: planRowId,
          created_by: createdBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false as const,
          error: data.error ?? 'Erro ao publicar',
          details: data.details as string[] | undefined,
        };
      }
      await refresh();
      return { ok: true as const, ...data };
    },
    [deviceId, refresh]
  );

  return {
    plans,
    activeInstance,
    tableAvailable,
    loading,
    refresh,
    savePlan,
    publishPlan,
  };
}

export function useGrowCycleWeeklyStats(deviceId: string | null, instanceId?: string | null) {
  const [stats, setStats] = useState<GrowCycleWeeklyStatsRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId?.trim()) {
      setStats([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ device_id: deviceId });
    if (instanceId) q.set('instance_id', instanceId);

    void fetch(`/api/grow-cycle/weekly-stats?${q}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStats(data.stats ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deviceId, instanceId]);

  return { stats, loading };
}
