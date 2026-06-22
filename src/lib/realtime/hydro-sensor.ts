/**
 * PV hidro — distingue "sin sensor / defaults legacy" vs lectura real (incluso absurda en dev).
 * Sentinel: fila con ph/ec/temp/raw todos 0 o null (bridge defaults sin MQTT sensor).
 */
export type HydroSensorRow = {
  ph?: number | null;
  ph_raw?: number | null;
  ph_display_clamped?: number | null;
  temperature?: number | null;
  temperature_raw?: number | null;
  tds?: number | null;
  ec?: number | null;
  ec_raw?: number | null;
};

const isZeroOrMissing = (v: unknown): boolean =>
  v === null || v === undefined || v === 0;

const finiteNonZero = (v: unknown): boolean => {
  if (v == null) return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
};

/** Fila legacy / levels-only rellenada con ceros — no es lectura de sonda. */
export function isSentinelHydroRow(row: HydroSensorRow | null | undefined): boolean {
  if (!row) return false;
  return (
    isZeroOrMissing(row.ph_raw) &&
    isZeroOrMissing(row.ph_display_clamped) &&
    isZeroOrMissing(row.ph) &&
    isZeroOrMissing(row.tds) &&
    isZeroOrMissing(row.temperature) &&
    isZeroOrMissing(row.temperature_raw) &&
    isZeroOrMissing(row.ec_raw) &&
    isZeroOrMissing(row.ec)
  );
}

export function hasPhReading(row: HydroSensorRow | null | undefined): boolean {
  if (!row || isSentinelHydroRow(row)) return false;
  return (
    finiteNonZero(row.ph_raw) ||
    finiteNonZero(row.ph_display_clamped) ||
    (row.ph != null && Number.isFinite(Number(row.ph)) && row.ph !== 0)
  );
}

export function hasEcReading(row: HydroSensorRow | null | undefined): boolean {
  if (!row || isSentinelHydroRow(row)) return false;
  return finiteNonZero(row.ec) || finiteNonZero(row.ec_raw) || finiteNonZero(row.tds);
}

export function hasTemperatureReading(row: HydroSensorRow | null | undefined): boolean {
  if (!row || isSentinelHydroRow(row)) return false;
  return finiteNonZero(row.temperature_raw) || finiteNonZero(row.temperature);
}

/** Al menos un PV de sonda (pH, EC o temperatura) — no solo niveles. */
export function hasHydroSensorReading(row: HydroSensorRow | null | undefined): boolean {
  return hasPhReading(row) || hasEcReading(row) || hasTemperatureReading(row);
}

export function resolveTemperatureForDisplay(
  row: Pick<HydroSensorRow, 'temperature' | 'temperature_raw'> | null | undefined
): number | null {
  if (!row || isSentinelHydroRow(row)) return null;
  if (row.temperature_raw != null && Number.isFinite(Number(row.temperature_raw))) {
    const raw = Number(row.temperature_raw);
    if (raw !== 0) return raw;
  }
  if (row.temperature != null && Number.isFinite(Number(row.temperature))) {
    const t = Number(row.temperature);
    if (t !== 0) return t;
  }
  return null;
}
