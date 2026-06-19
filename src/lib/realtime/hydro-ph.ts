/** Fallback REST lento para pH si Realtime pierde eventos. */
import type { HydroMeasurement } from '@/lib/supabase';
import { isSentinelHydroRow, type HydroSensorRow } from '@/lib/realtime/hydro-sensor';

export const HYDRO_PH_FALLBACK_MS = 90 * 1000;

/** Faixa hidroponia — só QC visual opcional; não bloqueia controle em dev. */
export const PH_MIN_PLAUSIBLE = 4.0;
export const PH_MAX_PLAUSIBLE = 9.0;

export function isPlausiblePh(ph: number | null | undefined): ph is number {
  if (ph === null || ph === undefined) return false;
  const n = Number(ph);
  if (Number.isNaN(n) || !Number.isFinite(n)) return false;
  return n >= PH_MIN_PLAUSIBLE && n <= PH_MAX_PLAUSIBLE;
}

/** pH parseado e finito — sem filtro de intervalo (paridade com resolveEcForDisplay). */
export function isFinitePh(ph: number | null | undefined): ph is number {
  if (ph === null || ph === undefined) return false;
  const n = Number(ph);
  return !Number.isNaN(n) && Number.isFinite(n);
}

export function resolvePh(
  row: { ph?: number | null; ph_raw?: number | null; ph_display_clamped?: number | null } | null | undefined
): number | null {
  if (!row || isSentinelHydroRow(row)) return null;
  if (row.ph_raw != null && !Number.isNaN(Number(row.ph_raw))) {
    const raw = Number(row.ph_raw);
    if (Number.isFinite(raw) && raw !== 0) return raw;
    if (raw === 0 && row.ph_display_clamped != null && Number(row.ph_display_clamped) !== 0) {
      return Number(row.ph_display_clamped);
    }
    if (raw === 0) return null;
  }
  if (row.ph_raw == null && row.ph_display_clamped == null && row.ph === 0) {
    return null;
  }
  if (row.ph == null) return null;
  const n = Number(row.ph);
  if (n === 0) return null;
  return Number.isNaN(n) ? null : n;
}

/** Fila trae al menos un PV hidro (no solo niveles / defaults legacy ph=0 tds=0). */
export function hasHydroSensorReading(
  row: HydroSensorRow | null | undefined
): boolean {
  if (!row || isSentinelHydroRow(row)) return false;
  const finiteNonZero = (v: unknown) => {
    if (v == null) return false;
    const n = Number(v);
    return Number.isFinite(n) && n !== 0;
  };
  const finiteAny = (v: unknown) => v != null && Number.isFinite(Number(v));
  if (finiteNonZero(row.ph_raw)) return true;
  if (finiteNonZero(row.temperature_raw)) return true;
  if (finiteNonZero(row.ph_display_clamped)) return true;
  if (finiteAny(row.ph) && row.ph !== 0) return true;
  if (finiteAny(row.tds) && row.tds !== 0) return true;
  if (finiteAny(row.ec_raw) && row.ec_raw !== 0) return true;
  if (finiteAny(row.ec) && row.ec !== 0) return true;
  if (finiteAny(row.temperature) && row.temperature !== 0) return true;
  return false;
}

/** Realtime levels-only: conservar último PV en cards. */
export function mergeHydroMeasurements(
  prev: HydroMeasurement | null,
  incoming: HydroMeasurement
): HydroMeasurement {
  if (hasHydroSensorReading(incoming)) {
    return incoming;
  }
  if (!prev || !hasHydroSensorReading(prev)) {
    return incoming;
  }
  return {
    ...incoming,
    ph_raw: prev.ph_raw,
    ph_display_clamped: prev.ph_display_clamped,
    ph: prev.ph,
    tds: prev.tds,
    temperature: prev.temperature,
    temperature_raw: prev.temperature_raw,
    ec_raw: prev.ec_raw,
    ec: prev.ec,
  };
}

/** pH para gráficos — usa clamp DB; fallback ph legacy. */
export function resolvePhForChart(
  row: { ph?: number | null; ph_display_clamped?: number | null } | null | undefined
): number | null {
  if (!row) return null;
  if (row.ph_display_clamped != null && !Number.isNaN(Number(row.ph_display_clamped))) {
    return Number(row.ph_display_clamped);
  }
  const ph = resolvePhForDisplay(row);
  if (ph == null) return null;
  if (ph < 0 || ph > 14) return null;
  return ph;
}

export function resolvePhPlausible(
  row: { ph?: number | null } | null | undefined
): number | null {
  const ph = resolvePh(row);
  return isPlausiblePh(ph) ? ph : null;
}

/**
 * pH para display / Auto pH — alinhado ao EC: aceita qualquer valor finito parseado.
 * Rejeita apenas NaN / ±Infinity (lixo de parse).
 */
export function resolvePhForDisplay(
  row: { ph?: number | null } | null | undefined
): number | null {
  const ph = resolvePh(row);
  return isFinitePh(ph) ? ph : null;
}

/**
 * pH para controle Auto pH — qualquer valor finito (paridade firmware isfinite + EC).
 * Use isPlausiblePh apenas para QC visual opcional.
 */
export function resolvePhForControl(
  row: { ph?: number | null } | null | undefined
): number | null {
  return resolvePhForDisplay(row);
}

export function resolvePhForControlValue(ph: number | null | undefined): number | null {
  if (ph == null) return null;
  const n = Number(ph);
  return isFinitePh(n) ? n : null;
}
