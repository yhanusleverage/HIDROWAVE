/**
 * Leitura EC/pH de hydro_measurements — REST (/api/hydro-data) + WSS.
 * liveOnly: dashboard — só PV fresco; default stale-while-revalidate para /automacao.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { HydroMeasurement } from '@/lib/supabase';
import { subscribeSensorMeasurements } from '@/lib/realtime/sensor-measurements';
import { resolveEcForDisplay, HYDRO_EC_FALLBACK_MS } from '@/lib/realtime/hydro-ec';
import { resolvePh, resolvePhForDisplay } from '@/lib/realtime/hydro-ph';
import {
  isHydroRowFresh,
  resolveLiveEcForDisplay,
  resolveLivePhForDisplay,
} from '@/lib/realtime/hydro-freshness';
import { hasHydroSensorReading } from '@/lib/realtime/hydro-sensor';
import { setVisibleInterval } from '@/lib/realtime/visible-interval';

export interface HydroEcReadingOptions {
  liveOnly?: boolean;
}

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
  liveOnly: boolean,
  setEc: Dispatch<SetStateAction<number | null>>,
  setPh: Dispatch<SetStateAction<number | null>>,
  setPhRaw: Dispatch<SetStateAction<number | null>>,
  setLastUpdatedAt: Dispatch<SetStateAction<number | null>>,
  setSensorUpdatedAt: Dispatch<SetStateAction<string | null>>
) {
  const sensorFresh = hasHydroSensorReading(row) && isHydroRowFresh(row);
  const sensorTs = row.created_at ?? null;

  if (liveOnly) {
    if (!sensorFresh) {
      setEc(null);
      setPh(null);
      setPhRaw(null);
      setSensorUpdatedAt(null);
      return;
    }

    setEc(resolveLiveEcForDisplay(row, sensorTs));
    const livePh = resolveLivePhForDisplay(row, sensorTs);
    setPh(livePh);
    setPhRaw(livePh);
    setSensorUpdatedAt(sensorTs);
    setLastUpdatedAt(Date.now());
    return;
  }

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
  if (sensorFresh && sensorTs) {
    setSensorUpdatedAt(sensorTs);
  }
}

export function useHydroEcReading(
  deviceId: string,
  enabled = true,
  options: HydroEcReadingOptions = {}
): HydroEcReadingResult {
  const { liveOnly = false } = options;
  const [ec, setEc] = useState<number | null>(null);
  const [ph, setPh] = useState<number | null>(null);
  const [phRaw, setPhRaw] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [, setSensorUpdatedAt] = useState<string | null>(null);
  const deviceIdRef = useRef(deviceId);
  const liveOnlyRef = useRef(liveOnly);
  deviceIdRef.current = deviceId;
  liveOnlyRef.current = liveOnly;

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

      applyHydroRow(
        data,
        liveOnlyRef.current,
        setEc,
        setPh,
        setPhRaw,
        setLastUpdatedAt,
        setSensorUpdatedAt
      );
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
    setSensorUpdatedAt(null);
  }, [deviceId]);

  useEffect(() => {
    const id = deviceId?.trim();
    if (!enabled || !id || id === 'default_device') return;

    refresh();

    const unsubscribe = subscribeSensorMeasurements(id, {
      onHydro: (row) => {
        if (row.device_id && row.device_id !== id) return;
        if (!hasHydroFields(row)) return;
        applyHydroRow(
          row,
          liveOnlyRef.current,
          setEc,
          setPh,
          setPhRaw,
          setLastUpdatedAt,
          setSensorUpdatedAt
        );
      },
    });

    const clearFallback = setVisibleInterval(refresh, HYDRO_EC_FALLBACK_MS);

    return () => {
      unsubscribe();
      clearFallback();
    };
  }, [deviceId, enabled, refresh, liveOnly]);

  return { ec, ph, phRaw, isLoading, lastUpdatedAt };
}
