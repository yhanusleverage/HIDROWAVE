/**
 * Leitura EC/pH de hydro_measurements — REST (/api/hydro-data) + WSS.
 * Stale-while-revalidate: nunca apaga leitura válida por parse/evento falho.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { HydroMeasurement } from '@/lib/supabase';
import { subscribeSensorMeasurements } from '@/lib/realtime/sensor-measurements';
import { resolveEcForDisplay, HYDRO_EC_FALLBACK_MS } from '@/lib/realtime/hydro-ec';
import { resolvePh, resolvePhForDisplay } from '@/lib/realtime/hydro-ph';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';

export interface HydroEcReadingResult {
  ec: number | null;
  ph: number | null;
  /** Último pH parseado (mesmo valor que ph após alinhamento com EC). */
  phRaw: number | null;
  isLoading: boolean;
  lastUpdatedAt: number | null;
}

function hasHydroFields(row: HydroMeasurement | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false;
  return (
    row.water_level_ok !== undefined ||
    row.level_1 !== undefined ||
    row.level_2 !== undefined ||
    row.level_3 !== undefined ||
    row.level_4 !== undefined ||
    row.temperature !== undefined ||
    row.ph !== undefined ||
    row.ph_raw !== undefined ||
    row.tds !== undefined ||
    row.ec !== undefined ||
    row.ec_raw !== undefined
  );
}

function applyHydroRow(
  row: HydroMeasurement,
  setEc: Dispatch<SetStateAction<number | null>>,
  setPh: Dispatch<SetStateAction<number | null>>,
  setPhRaw: Dispatch<SetStateAction<number | null>>,
  setLastUpdatedAt: Dispatch<SetStateAction<number | null>>
) {
  const ec = resolveEcForDisplay(row);
  const rawPh = resolvePh(row);
  const displayPh = resolvePhForDisplay(row);

  const now = Date.now();
  if (ec !== null) {
    setEc(ec);
  }
  if (rawPh !== null) {
    setPhRaw(rawPh);
    setPh(rawPh);
  } else if (displayPh !== null) {
    setPh(displayPh);
  }
  if (ec !== null || rawPh !== null || displayPh !== null || row.water_level_ok !== undefined) {
    setLastUpdatedAt(now);
  }
}

export function useHydroEcReading(
  deviceId: string,
  enabled = true
): HydroEcReadingResult {
  const [ec, setEc] = useState<number | null>(null);
  const [ph, setPh] = useState<number | null>(null);
  const [phRaw, setPhRaw] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;

  const refresh = useCallback(async () => {
    const id = deviceIdRef.current?.trim();
    if (!enabled || !id || id === 'default_device') return;

    try {
      setIsLoading(true);
      const q = encodeURIComponent(id);
      const res = await fetch(`/api/hydro-data?device_id=${q}`);
      if (!res.ok) {
        console.warn('[useHydroEcReading] REST falhou:', res.status);
        return;
      }

      const data = (await res.json()) as HydroMeasurement;
      if (!hasHydroFields(data)) return;

      applyHydroRow(data, setEc, setPh, setPhRaw, setLastUpdatedAt);
    } catch (err) {
      console.warn('[useHydroEcReading] Erro no fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    setEc(null);
    setPh(null);
    setPhRaw(null);
    setLastUpdatedAt(null);
  }, [deviceId]);

  useEffect(() => {
    const id = deviceId?.trim();
    if (!enabled || !id || id === 'default_device') return;

    refresh();

    const unsubscribe = subscribeSensorMeasurements(id, {
      onHydro: (row) => {
        if (row.device_id && row.device_id !== id) return;
        if (!hasHydroFields(row)) return;
        applyHydroRow(row, setEc, setPh, setPhRaw, setLastUpdatedAt);
      },
    });

    const clearFallback = setVisibleInterval(refresh, HYDRO_EC_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearFallback();
    };
  }, [deviceId, enabled, refresh]);

  return { ec, ph, phRaw, isLoading, lastUpdatedAt };
}
