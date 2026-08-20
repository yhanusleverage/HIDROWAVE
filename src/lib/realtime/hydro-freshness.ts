/**
 * PV hidro "vivo" — só mostra valores com created_at recente (paridade device online).
 */
import type { HydroMeasurement } from '@/lib/supabase';
import { ONLINE_THRESHOLD_MINUTES } from '@/lib/realtime/device-status';
import { resolveEcForDisplay } from '@/lib/realtime/hydro-ec';
import { resolvePhForDisplay } from '@/lib/realtime/hydro-ph';
import {
  hasHydroSensorReading,
  hasPhReading,
  hasEcReading,
  hasTemperatureReading,
  resolveTemperatureForDisplay,
} from '@/lib/realtime/hydro-sensor';

export const HYDRO_LIVE_MAX_AGE_MS = ONLINE_THRESHOLD_MINUTES * 60 * 1000;

export function getHydroRowAgeMs(
  row: { created_at?: string | null } | null | undefined
): number | null {
  if (!row?.created_at) return null;
  const ts = new Date(row.created_at).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts;
}

export function isHydroRowFresh(
  row: { created_at?: string | null } | null | undefined,
  maxAgeMs: number = HYDRO_LIVE_MAX_AGE_MS
): boolean {
  const age = getHydroRowAgeMs(row);
  if (age === null) return false;
  return age >= 0 && age <= maxAgeMs;
}

/** Remove PV de sonda — mantém metadados e níveis. */
export function stripHydroSensorPv(row: HydroMeasurement): HydroMeasurement {
  return {
    ...row,
    ph: undefined as unknown as number,
    ph_raw: null,
    ph_display_clamped: null,
    ec: null,
    ec_raw: null,
    tds: null,
    temperature: undefined as unknown as number,
    temperature_raw: null,
  };
}

/**
 * Níveis/agua de latestAny; PV só de freshSensorRow se existir e for fresca.
 */
export function mergeHydroLiveSnapshot(
  latestAny: HydroMeasurement,
  freshSensorRow: HydroMeasurement | null | undefined
): HydroMeasurement {
  const base = stripHydroSensorPv(latestAny);

  if (!freshSensorRow || !isHydroRowFresh(freshSensorRow)) {
    return base;
  }

  const merged: HydroMeasurement = { ...base };

  if (hasPhReading(freshSensorRow)) {
    merged.ph = freshSensorRow.ph;
    merged.ph_raw = freshSensorRow.ph_raw;
    merged.ph_display_clamped = freshSensorRow.ph_display_clamped;
  }
  if (hasEcReading(freshSensorRow)) {
    merged.ec = freshSensorRow.ec;
    merged.ec_raw = freshSensorRow.ec_raw;
    merged.tds = freshSensorRow.tds;
  }
  if (hasTemperatureReading(freshSensorRow)) {
    merged.temperature = freshSensorRow.temperature;
    merged.temperature_raw = freshSensorRow.temperature_raw;
  }

  return merged;
}

export type HydroLiveState = {
  row: HydroMeasurement | null;
  /** created_at da fila que forneceu o PV de sonda */
  sensorUpdatedAt: string | null;
};

export function emptyHydroLiveState(): HydroLiveState {
  return { row: null, sensorUpdatedAt: null };
}

function sensorTimestampFromRow(row: HydroMeasurement): string | null {
  if (!hasHydroSensorReading(row)) return null;
  return row.created_at ?? null;
}

/**
 * Merge live para Realtime/REST no dashboard — não revive PV stale.
 */
export function mergeHydroLiveState(
  prev: HydroLiveState,
  incoming: HydroMeasurement,
  maxAgeMs: number = HYDRO_LIVE_MAX_AGE_MS
): HydroLiveState {
  const incomingHasSensor = hasHydroSensorReading(incoming);
  const incomingSensorFresh =
    incomingHasSensor && isHydroRowFresh(incoming, maxAgeMs);

  let sensorUpdatedAt = prev.sensorUpdatedAt;
  let row: HydroMeasurement;

  if (incomingSensorFresh) {
    row = mergeHydroLiveSnapshot(incoming, incoming);
    sensorUpdatedAt = sensorTimestampFromRow(incoming);
  } else if (prev.sensorUpdatedAt && prev.row) {
    const prevSensorAge = getHydroRowAgeMs({ created_at: prev.sensorUpdatedAt });
    const prevSensorStillFresh =
      prevSensorAge !== null && prevSensorAge >= 0 && prevSensorAge <= maxAgeMs;

    if (prevSensorStillFresh && prev.row) {
      row = mergeHydroLiveSnapshot(incoming, {
        ...prev.row,
        created_at: prev.sensorUpdatedAt,
      });
      sensorUpdatedAt = prev.sensorUpdatedAt;
    } else {
      row = mergeHydroLiveSnapshot(incoming, null);
      sensorUpdatedAt = null;
    }
  } else {
    row = mergeHydroLiveSnapshot(incoming, null);
    sensorUpdatedAt = null;
  }

  return { row, sensorUpdatedAt };
}

export function hasFreshHydroSensorReading(
  row: HydroMeasurement | null | undefined,
  sensorUpdatedAt: string | null | undefined,
  maxAgeMs: number = HYDRO_LIVE_MAX_AGE_MS
): boolean {
  if (!row || !hasHydroSensorReading(row)) return false;
  const ts = sensorUpdatedAt ?? row.created_at;
  return isHydroRowFresh({ created_at: ts }, maxAgeMs);
}

export function resolveLivePhForDisplay(
  row: HydroMeasurement | null | undefined,
  sensorUpdatedAt?: string | null
): number | null {
  if (!row || !hasFreshHydroSensorReading(row, sensorUpdatedAt)) return null;
  return resolvePhForDisplay(row);
}

export function resolveLiveEcForDisplay(
  row: HydroMeasurement | null | undefined,
  sensorUpdatedAt?: string | null
): number | null {
  if (!row || !hasFreshHydroSensorReading(row, sensorUpdatedAt)) return null;
  return resolveEcForDisplay(row);
}

export function resolveLiveTemperatureForDisplay(
  row: HydroMeasurement | null | undefined,
  sensorUpdatedAt?: string | null
): number | null {
  if (!row || !hasFreshHydroSensorReading(row, sensorUpdatedAt)) return null;
  return resolveTemperatureForDisplay(row);
}
