/** Fallback REST si Realtime pierde eventos. */
import { isSentinelHydroRow } from '@/lib/realtime/hydro-sensor';
export const HYDRO_EC_FALLBACK_MS = 30 * 1000;

/** EC plausível para hidroponia (µS/cm) — alinhado ao interlock firmware. */
export const EC_MIN_PLAUSIBLE = 100;
export const EC_MAX_PLAUSIBLE = 10_000;

/** Coluna `tds` legacy em hydro_measurements — interpretada como µS/cm directo. */
export function legacyTdsAsEc(tds: number | null | undefined): number | null {
  if (tds === null || tds === undefined) return null;
  const n = Number(tds);
  if (Number.isNaN(n)) return null;
  return n;
}

/** @deprecated Use legacyTdsAsEc — mantido para imports antigos. */
export const ecFromTds = legacyTdsAsEc;

export function isPlausibleEc(ec: number | null | undefined): ec is number {
  if (ec === null || ec === undefined) return false;
  const n = Number(ec);
  if (Number.isNaN(n) || !Number.isFinite(n)) return false;
  return n >= EC_MIN_PLAUSIBLE && n <= EC_MAX_PLAUSIBLE;
}

/** EC direto ou derivado de coluna tds legacy — sem filtro de intervalo. */
export function resolveEc(
  row: { ec?: number | null; ec_raw?: number | null; tds?: number | null } | null | undefined
): number | null {
  if (!row || isSentinelHydroRow(row)) return null;
  if (row.ec != null && !Number.isNaN(Number(row.ec))) {
    const ec = Number(row.ec);
    return ec !== 0 ? ec : null;
  }
  if (row.ec_raw != null && !Number.isNaN(Number(row.ec_raw))) {
    const raw = Number(row.ec_raw);
    if (Number.isFinite(raw) && raw !== 0) return raw;
    if (raw === 0) return null;
  }
  const fromLegacyTds = legacyTdsAsEc(row.tds);
  return fromLegacyTds !== 0 ? fromLegacyTds : null;
}

/** EC com QC — retorna null se inválido (interlock Auto EC / dosagem). */
export function resolveEcPlausible(
  row: { ec?: number | null; tds?: number | null } | null | undefined
): number | null {
  const ec = resolveEc(row);
  return isPlausibleEc(ec) ? ec : null;
}

/**
 * EC para display na UI — alinhado ao dashboard `calculateEC`.
 * Prioridade: coluna `ec`, depois `ec_raw`, depois `tds` legacy (µS/cm). Aceita 0 como valor válido.
 */
export function resolveEcForDisplay(
  row: { ec?: number | null; ec_raw?: number | null; tds?: number | null } | null | undefined
): number | null {
  return resolveEc(row);
}
