/** Calibragem química pH — domínio pH visível ao operador. */

export const MIN_DELTA_PH = 0.05;

export interface PhCalibrationResult {
  mlPerPhUnit: number;
  mlPerLiterPerPhUnit: number | null;
  deltaPh: number;
}

export function mlPerPhUnitFromDose(
  mlDosed: number,
  phBefore: number,
  phAfter: number
): PhCalibrationResult | null {
  if (!Number.isFinite(mlDosed) || mlDosed <= 0) return null;
  if (!Number.isFinite(phBefore) || !Number.isFinite(phAfter)) return null;

  const deltaPh = Math.abs(phAfter - phBefore);
  if (deltaPh < MIN_DELTA_PH) return null;

  const mlPerPhUnit = mlDosed / deltaPh;
  if (!Number.isFinite(mlPerPhUnit) || mlPerPhUnit <= 0) return null;

  return { mlPerPhUnit, mlPerLiterPerPhUnit: null, deltaPh };
}

export function mlPerLiterPerPhUnit(
  mlPerPhUnit: number,
  volumeLiters: number
): number | null {
  if (!Number.isFinite(mlPerPhUnit) || mlPerPhUnit <= 0) return null;
  if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) return null;
  return mlPerPhUnit / volumeLiters;
}

export function withVolume(
  result: PhCalibrationResult,
  volumeLiters: number
): PhCalibrationResult {
  return {
    ...result,
    mlPerLiterPerPhUnit: mlPerLiterPerPhUnit(result.mlPerPhUnit, volumeLiters),
  };
}

export function formatMlPerPhUnit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMlPerLiterPerPhUnit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 0.01) {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  }
  return value.toExponential(2);
}

export interface PhCalibrationSummaryInput {
  mlPerPhUnitBase: number | null;
  mlPerPhUnitAcid: number | null;
  volumeLiters: number;
  flowRatePhUp?: number | null;
  flowRatePhDown?: number | null;
}

export function formatPhCalibrationLine(
  label: string,
  mlPerPhUnit: number | null,
  volumeLiters: number,
  flowRateMlPerSec?: number | null
): string {
  const mlL =
    mlPerPhUnit != null && volumeLiters > 0
      ? mlPerLiterPerPhUnit(mlPerPhUnit, volumeLiters)
      : null;
  const parts = [
    mlPerPhUnit != null ? `${formatMlPerPhUnit(mlPerPhUnit)} ml/unid` : '— ml/unid',
    mlL != null ? `${formatMlPerLiterPerPhUnit(mlL)} ml/L/unid` : '— ml/L/unid',
  ];
  if (flowRateMlPerSec != null && flowRateMlPerSec > 0) {
    parts.push(`${flowRateMlPerSec.toFixed(2)} ml/s`);
  }
  return `${label}: ${parts.join(' · ')}`;
}
