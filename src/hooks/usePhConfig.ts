/**
 * Config Auto pH do Supabase — poll leve para dashboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { optionalDoserRelay } from '@/lib/relay-allocation';

export interface PhConfigSnapshot {
  auto_enabled: boolean;
  intervalo_auto_ph: number;
  ph_setpoint: number;
  ph_tolerance: number;
  tempo_recirculacao: number;
  relay_ph_up: number | null;
  relay_ph_down: number | null;
  aggressiveness: number;
  pulse_ml: number;
  pulse_gap_sec: number;
  volume: number;
  s_up: number;
  s_down: number;
  ml_per_ph_unit_acid: number;
  ml_per_ph_unit_base: number;
  flow_rate_ph_up: number;
  flow_rate_ph_down: number;
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
  aggressiveness: 0.5,
  pulse_ml: 2,
  pulse_gap_sec: 2,
  volume: 0,
  s_up: 0,
  s_down: 0,
  ml_per_ph_unit_acid: 2,
  ml_per_ph_unit_base: 2,
  flow_rate_ph_up: 0,
  flow_rate_ph_down: 0,
  isLoading: true,
};

export function usePhConfig(deviceId: string, enabled = true): PhConfigSnapshot {
  const [snapshot, setSnapshot] = useState<PhConfigSnapshot>(DEFAULT);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++seq.current;
    if (!enabled || !deviceId?.trim()) {
      if (seq.current === ticket) setSnapshot((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const q = encodeURIComponent(deviceId.trim());
      const res = await fetch(`/api/ph-controller/config?device_id=${q}`);
      if (seq.current !== ticket) return;
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (seq.current !== ticket || !data) return;
      setSnapshot({
        auto_enabled: Boolean(data.auto_enabled),
        intervalo_auto_ph: Number(data.intervalo_auto_ph) || 300,
        ph_setpoint: Number(data.ph_setpoint) || 6.0,
        ph_tolerance: Number(data.ph_tolerance) || 0.2,
        tempo_recirculacao: Number(data.tempo_recirculacao) || 60,
        relay_ph_up: optionalDoserRelay(data.relay_ph_up),
        relay_ph_down: optionalDoserRelay(data.relay_ph_down),
        aggressiveness: Number(data.aggressiveness) || 0.5,
        pulse_ml: Number(data.pulse_ml) || 2,
        pulse_gap_sec: Number(data.pulse_gap_sec) || 2,
        volume: Number(data.volume) || 0,
        s_up: Number(data.s_up ?? data.sUp) || 0,
        s_down: Number(data.s_down ?? data.sDown) || 0,
        ml_per_ph_unit_acid:
          Number(data.ml_per_ph_unit_acid ?? data.ml_per_ph_unit) || 2,
        ml_per_ph_unit_base:
          Number(data.ml_per_ph_unit_base ?? data.ml_per_ph_unit) || 2,
        flow_rate_ph_up: Number(data.flow_rate_ph_up ?? data.flowRatePhUp) || 0,
        flow_rate_ph_down: Number(data.flow_rate_ph_down ?? data.flowRatePhDown) || 0,
        isLoading: false,
      });
    } catch {
      if (seq.current !== ticket) return;
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
