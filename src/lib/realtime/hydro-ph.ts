/** Fallback REST lento para pH si Realtime pierde eventos. */
export const HYDRO_PH_FALLBACK_MS = 90 * 1000;

/** pH plausível para hidroponia. */
export const PH_MIN_PLAUSIBLE = 4.0;
export const PH_MAX_PLAUSIBLE = 9.0;

export function isPlausiblePh(ph: number | null | undefined): ph is number {
  if (ph === null || ph === undefined) return false;
  const n = Number(ph);
  if (Number.isNaN(n) || !Number.isFinite(n)) return false;
  return n >= PH_MIN_PLAUSIBLE && n <= PH_MAX_PLAUSIBLE;
}

export function resolvePh(
  row: { ph?: number | null } | null | undefined
): number | null {
  if (!row || row.ph == null) return null;
  const n = Number(row.ph);
  return Number.isNaN(n) ? null : n;
}

export function resolvePhPlausible(
  row: { ph?: number | null } | null | undefined
): number | null {
  const ph = resolvePh(row);
  return isPlausiblePh(ph) ? ph : null;
}

/**
 * pH para display / Auto pH — rejeita lixo de sensor (ex.: 2e-39).
 * Stale-while-revalidate: o hook só actualiza quando o valor passa QC.
 */
export function resolvePhForDisplay(
  row: { ph?: number | null } | null | undefined
): number | null {
  const ph = resolvePh(row);
  return isPlausiblePh(ph) ? ph : null;
}

/** Seed Kacid/Kbase desde ml/unidade pH — espelha firmware AdaptivePHController. */
export function seedKFromMlPerPhUnit(
  phSetpoint: number,
  mlPerPhUnit: number
): number | null {
  if (mlPerPhUnit < 0.01 || !isPlausiblePh(phSetpoint)) return null;
  const H = Math.pow(10, -phSetpoint);
  const erroHOneUnit = H * 9;
  if (erroHOneUnit < 1e-15) return null;
  return erroHOneUnit / mlPerPhUnit;
}
