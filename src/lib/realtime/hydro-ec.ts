/** Fallback REST lento para EC si Realtime pierde eventos. */
export const HYDRO_EC_FALLBACK_MS = 90 * 1000;

/** TDS (ppm) → EC (µS/cm), factor usado en EC Controller. */
export function ecFromTds(tds: number | null | undefined): number | null {
  if (tds === null || tds === undefined || Number.isNaN(Number(tds))) return null;
  return Number(tds) * 2;
}
