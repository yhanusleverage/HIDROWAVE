/**
 * Config Auto EC do Supabase (ec_config_view) — poll leve para dashboard.
 */

import { useCallback, useEffect, useState } from 'react';

export interface EcConfigSnapshot {
  auto_enabled: boolean;
  intervalo_auto_ec: number;
  ec_setpoint: number;
  tolerance: number;
  tempo_recirculacao: number;
  volume: number;
  base_dose: number;
  aggressiveness: number;
  pulse_ml: number;
  pulse_gap_sec: number;
  nutrients: Array<{ mlPerLiter: number; flowRate?: number | null }>;
  isLoading: boolean;
}

const POLL_MS = 30_000;

const DEFAULT: EcConfigSnapshot = {
  auto_enabled: false,
  intervalo_auto_ec: 300,
  ec_setpoint: 0,
  tolerance: 50,
  tempo_recirculacao: 60,
  volume: 0,
  base_dose: 0,
  aggressiveness: 0.5,
  pulse_ml: 2,
  pulse_gap_sec: 2,
  nutrients: [],
  isLoading: true,
};

export function useEcConfig(deviceId: string, enabled = true): EcConfigSnapshot {
  const [snapshot, setSnapshot] = useState<EcConfigSnapshot>(DEFAULT);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) {
      setSnapshot((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const q = encodeURIComponent(deviceId.trim());
      const res = await fetch(`/api/ec-controller/config?device_id=${q}`);
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data) return;
      const nutrientsRaw = Array.isArray(data.nutrients) ? data.nutrients : [];
      setSnapshot({
        auto_enabled: Boolean(data.auto_enabled),
        intervalo_auto_ec: Number(data.intervalo_auto_ec) || 300,
        ec_setpoint: Number(data.ec_setpoint) || 0,
        tolerance: Number(data.tolerance) || 50,
        tempo_recirculacao: Number(data.tempo_recirculacao) || 60,
        volume: Number(data.volume) || 0,
        base_dose: Number(data.base_dose) || 0,
        aggressiveness: Number(data.aggressiveness) || 0.5,
        pulse_ml: Number(data.pulse_ml) || 2,
        pulse_gap_sec: Number(data.pulse_gap_sec) || 2,
        nutrients: nutrientsRaw.map(
          (n: { mlPerLiter?: number; flowRate?: number | null }) => ({
            mlPerLiter: Number(n.mlPerLiter) || 0,
            flowRate: n.flowRate != null ? Number(n.flowRate) : null,
          })
        ),
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
