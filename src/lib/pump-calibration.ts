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

/**
 * Exibição em toast/UI — precisão real (até 4 casas).
 * Ex.: 1 ml ÷ 0,9875 ml/s → "1.013" (não "1.0" nem "2").
 */
export function formatDoseDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) {
    return parseFloat(seconds.toFixed(4)).toString();
  }
  return String(Math.round(seconds));
}

/**
 * Duração enviada ao relé (inteiro). Arredonda ao mais próximo — evita ceil que infla o tempo.
 * Ex.: 1,013 s → 1 s no comando (firmware usa segundos inteiros).
 */
export function doseDurationSecondsForRelay(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.round(seconds));
}

export function formatFlowRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1) return `${value.toFixed(2)} ml/s`;
  return `${value.toFixed(4)} ml/s`;
}

export function formatFlowRateMlPerMin(valueMlPerSec: number): string {
  if (!Number.isFinite(valueMlPerSec) || valueMlPerSec <= 0) return '—';
  return `${(valueMlPerSec * 60).toFixed(2)} ml/min`;
}

/** Durações sugeridas para teste de calibragem (segundos). */
export const CALIBRATION_TEST_DURATIONS_SEC = [30, 60, 120] as const;
