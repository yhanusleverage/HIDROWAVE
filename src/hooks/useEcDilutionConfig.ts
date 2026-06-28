'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseConfigApiError } from '@/lib/controller-config-api';
import { normalizeSlaveMac } from '@/lib/slave-relay-allocation';

export interface EcDilutionConfigSnapshot {
  dilution_auto_enabled: boolean;
  dilution_drain_relay: number;
  dilution_fill_relay: number;
  dilution_drain_slave_mac: string;
  dilution_fill_slave_mac: string;
  dilution_max_volume_l: number;
  flowmeter_pulses_per_liter: number;
  dilution_fill_flow_lps: number;
  volume: number;
  ec_setpoint: number;
  tolerance: number;
  isLoading: boolean;
  isSaving: boolean;
}

const DEFAULT: EcDilutionConfigSnapshot = {
  dilution_auto_enabled: false,
  dilution_drain_relay: -1,
  dilution_fill_relay: -1,
  dilution_drain_slave_mac: '',
  dilution_fill_slave_mac: '',
  dilution_max_volume_l: 50,
  flowmeter_pulses_per_liter: 450,
  dilution_fill_flow_lps: 0.5,
  volume: 100,
  ec_setpoint: 0,
  tolerance: 50,
  isLoading: true,
  isSaving: false,
};

function parseConfig(data: Record<string, unknown>): Omit<EcDilutionConfigSnapshot, 'isLoading' | 'isSaving'> {
  return {
    dilution_auto_enabled: Boolean(data.dilution_auto_enabled),
    dilution_drain_relay: Number(data.dilution_drain_relay ?? -1),
    dilution_fill_relay: Number(data.dilution_fill_relay ?? -1),
    dilution_drain_slave_mac: normalizeSlaveMac(
      typeof data.dilution_drain_slave_mac === 'string' ? data.dilution_drain_slave_mac : ''
    ),
    dilution_fill_slave_mac: normalizeSlaveMac(
      typeof data.dilution_fill_slave_mac === 'string' ? data.dilution_fill_slave_mac : ''
    ),
    dilution_max_volume_l: Number(data.dilution_max_volume_l) || 50,
    flowmeter_pulses_per_liter: Number(data.flowmeter_pulses_per_liter) || 450,
    dilution_fill_flow_lps: Number(data.dilution_fill_flow_lps) || 0.5,
    volume: Number(data.volume) || 100,
    ec_setpoint: Number(data.ec_setpoint) || 0,
    tolerance: Number(data.tolerance) || 50,
  };
}

export function useEcDilutionConfig(deviceId: string, enabled = true) {
  const [snapshot, setSnapshot] = useState<EcDilutionConfigSnapshot>(DEFAULT);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) {
      setSnapshot((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const q = encodeURIComponent(deviceId.trim());
      const res = await fetch(`/api/ec-controller/config?device_id=${q}`);
      if (!res.ok) {
        setSnapshot((s) => ({ ...s, isLoading: false }));
        return;
      }
      const data = await res.json();
      setSnapshot({ ...parseConfig(data), isLoading: false, isSaving: false });
    } catch {
      setSnapshot((s) => ({ ...s, isLoading: false }));
    }
  }, [deviceId, enabled]);

  const save = useCallback(
    async (patch: Partial<EcDilutionConfigSnapshot>) => {
      if (!deviceId?.trim()) return { ok: false as const, error: 'device_id ausente' };

      setSnapshot((s) => ({ ...s, isSaving: true }));
      try {
        const body: Record<string, unknown> = { device_id: deviceId.trim() };
        if (patch.dilution_auto_enabled !== undefined) {
          body.dilution_auto_enabled = patch.dilution_auto_enabled;
        }
        if (patch.dilution_drain_relay !== undefined) {
          body.dilution_drain_relay = patch.dilution_drain_relay;
        }
        if (patch.dilution_fill_relay !== undefined) {
          body.dilution_fill_relay = patch.dilution_fill_relay;
        }
        if (patch.dilution_drain_slave_mac !== undefined) {
          body.dilution_drain_slave_mac = patch.dilution_drain_slave_mac || null;
        }
        if (patch.dilution_fill_slave_mac !== undefined) {
          body.dilution_fill_slave_mac = patch.dilution_fill_slave_mac || null;
        }
        if (patch.dilution_max_volume_l !== undefined) {
          body.dilution_max_volume_l = patch.dilution_max_volume_l;
        }
        if (patch.flowmeter_pulses_per_liter !== undefined) {
          body.flowmeter_pulses_per_liter = patch.flowmeter_pulses_per_liter;
        }
        if (patch.dilution_fill_flow_lps !== undefined) {
          body.dilution_fill_flow_lps = patch.dilution_fill_flow_lps;
        }

        const res = await fetch('/api/ec-controller/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const parsed = await parseConfigApiError(res);
          setSnapshot((s) => ({ ...s, isSaving: false }));
          return { ok: false as const, error: parsed.message };
        }

        await refresh();
        return { ok: true as const };
      } catch (e) {
        setSnapshot((s) => ({ ...s, isSaving: false }));
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : 'Erro ao salvar',
        };
      }
    },
    [deviceId, refresh]
  );

  useEffect(() => {
    setSnapshot({ ...DEFAULT, isLoading: true });
  }, [deviceId]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;
    refresh();
  }, [deviceId, enabled, refresh]);

  const updateLocal = useCallback(
    (patch: Partial<EcDilutionConfigSnapshot>) => {
      setSnapshot((s) => ({ ...s, ...patch }));
    },
    []
  );

  return { ...snapshot, refresh, save, updateLocal };
}
