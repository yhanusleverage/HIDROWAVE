/**
 * Config Auto pH do Supabase — poll leve para dashboard.
 */

import { useCallback, useEffect, useState } from 'react';

export interface PhConfigSnapshot {
  auto_enabled: boolean;
  intervalo_auto_ph: number;
  ph_setpoint: number;
  ph_tolerance: number;
  tempo_recirculacao: number;
  relay_ph_up: number;
  relay_ph_down: number;
  isLoading: boolean;
}

const POLL_MS = 30_000;

const DEFAULT: PhConfigSnapshot = {
  auto_enabled: false,
  intervalo_auto_ph: 300,
  ph_setpoint: 6.0,
  ph_tolerance: 0.2,
  tempo_recirculacao: 60,
  relay_ph_up: 1,
  relay_ph_down: 0,
  isLoading: true,
};

export function usePhConfig(deviceId: string, enabled = true): PhConfigSnapshot {
  const [snapshot, setSnapshot] = useState<PhConfigSnapshot>(DEFAULT);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) {
      setSnapshot((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const q = encodeURIComponent(deviceId.trim());
      const res = await fetch(`/api/ph-controller/config?device_id=${q}`);
      if (!res.ok) return;

      const data = await res.json();
      setSnapshot({
        auto_enabled: Boolean(data.auto_enabled),
        intervalo_auto_ph: Number(data.intervalo_auto_ph) || 300,
        ph_setpoint: Number(data.ph_setpoint) || 6.0,
        ph_tolerance: Number(data.ph_tolerance) || 0.2,
        tempo_recirculacao: Number(data.tempo_recirculacao) || 60,
        relay_ph_up: Number(data.relay_ph_up) ?? 1,
        relay_ph_down: Number(data.relay_ph_down) ?? 0,
        isLoading: false,
      });
    } catch {
      setSnapshot((s) => ({ ...s, isLoading: false }));
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    setSnapshot({ ...DEFAULT, isLoading: true });
  }, [deviceId]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;

    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [deviceId, enabled, refresh]);

  return snapshot;
}
