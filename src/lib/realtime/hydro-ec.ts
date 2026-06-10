/** Fallback REST lento para EC si Realtime pierde eventos. */
export const HYDRO_EC_FALLBACK_MS = 90 * 1000;

/** EC plausível para hidroponia (µS/cm) — alinhado ao interlock firmware. */
export const EC_MIN_PLAUSIBLE = 100;
export const EC_MAX_PLAUSIBLE = 10_000;

/** TDS (ppm) → EC (µS/cm), factor usado en EC Controller. */
export function ecFromTds(tds: number | null | undefined): number | null {
  if (tds === null || tds === undefined) return null;
  const n = Number(tds);
  if (Number.isNaN(n)) return null;
  return n * 2;
}

export function isPlausibleEc(ec: number | null | undefined): ec is number {
  if (ec === null || ec === undefined) return false;
  const n = Number(ec);
  if (Number.isNaN(n) || !Number.isFinite(n)) return false;
  return n >= EC_MIN_PLAUSIBLE && n <= EC_MAX_PLAUSIBLE;
}

/** EC direto ou derivado de TDS — sem filtro de intervalo. */
export function resolveEc(
  row: { ec?: number | null; tds?: number | null } | null | undefined
): number | null {
  if (!row) return null;
  if (row.ec != null && !Number.isNaN(Number(row.ec))) return Number(row.ec);
  return ecFromTds(row.tds);
}

/** EC com QC — retorna null se inválido (interlock Auto EC / dosagem). */
export function resolveEcPlausible(
  row: { ec?: number | null; tds?: number | null } | null | undefined
): number | null {
  const ec = resolveEc(row);
  return isPlausibleEc(ec) ? ec : null;
}

/** Aceita EC=0; rejeita denormais do bridge (ex. 8e-29 µS/cm). */
function isDisplayableEc(n: number): boolean {
  if (Number.isNaN(n) || !Number.isFinite(n)) return false;
  if (n === 0) return true;
  return Math.abs(n) >= 1;
}

/**
 * EC para display na UI — alinhado ao dashboard `calculateEC`.
 * Aceita EC=0; rejeita NaN/Inf e floats denormalizados.
 */
export function resolveEcForDisplay(
  row: { ec?: number | null; tds?: number | null } | null | undefined
): number | null {
  if (!row) return null;

  if (row.ec != null && row.ec !== undefined) {
    const n = Number(row.ec);
    if (isDisplayableEc(n)) {
      return n;
    }
  }

  const fromTds = ecFromTds(row.tds);
  if (fromTds != null && isDisplayableEc(fromTds)) {
    return fromTds;
  }

  return null;
}
