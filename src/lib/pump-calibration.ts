/** Cálculos para calibragem de bombas peristálticas (vazão em ml/s). */

export function calculateFlowRateMlPerSecond(
  volumeMl: number,
  durationSeconds: number
): number | null {
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return volumeMl / durationSeconds;
}

export function calculateDoseDurationSeconds(
  volumeMl: number,
  flowRateMlPerSec: number
): number | null {
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return null;
  if (!Number.isFinite(flowRateMlPerSec) || flowRateMlPerSec <= 0) return null;
  return volumeMl / flowRateMlPerSec;
}

export function formatFlowRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1) return `${value.toFixed(2)} ml/s`;
  return `${value.toFixed(3)} ml/s`;
}

export function formatFlowRateMlPerMin(valueMlPerSec: number): string {
  if (!Number.isFinite(valueMlPerSec) || valueMlPerSec <= 0) return '—';
  return `${(valueMlPerSec * 60).toFixed(1)} ml/min`;
}

/** Durações sugeridas para teste de calibragem (segundos). */
export const CALIBRATION_TEST_DURATIONS_SEC = [30, 60, 120] as const;
