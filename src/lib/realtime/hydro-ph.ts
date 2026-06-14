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
 * pH para display na UI — alinhado ao dashboard (aceita qualquer pH numérico finito).
 */
export function resolvePhForDisplay(
  row: { ph?: number | null } | null | undefined
): number | null {
  if (!row) return null;
  if (row.ph !== null && row.ph !== undefined && !Number.isNaN(Number(row.ph))) {
    const n = Number(row.ph);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
