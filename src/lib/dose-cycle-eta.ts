/**
 * Estimación idle del ciclo Auto EC/pH: dosagem (pulsos+gaps) + homogeneização.
 * El ETA en vivo lo publica el firmware (*_operation_cycle_remaining_sec).
 */

export type EcCycleNutrientInput = {
  ml: number;
  flowRateMlPerSec: number;
};

export type EstimatePulsedDoseInput = {
  totalMl: number;
  pulseMl: number;
  pulseGapSec: number;
  flowRateMlPerSec: number;
};

/** Tiempo ON + gaps entre pulsos del mismo nutriente/bomba. */
export function estimatePulsedDoseSec(input: EstimatePulsedDoseInput): number {
  const { totalMl, pulseMl, pulseGapSec, flowRateMlPerSec } = input;
  if (totalMl <= 0.001 || flowRateMlPerSec < 0.01) return 0;
  const chunk = Math.max(0.05, pulseMl > 0 ? pulseMl : 0.05);
  const pulses = Math.ceil(totalMl / chunk);
  const onSec = totalMl / flowRateMlPerSec;
  const gapSec = pulses > 1 ? (pulses - 1) * Math.max(0, pulseGapSec) : 0;
  return Math.ceil(onSec + gapSec);
}

export type EstimateEcCycleInput = {
  nutrients: EcCycleNutrientInput[];
  pulseMl: number;
  pulseGapSec: number;
  interNutrientSec?: number;
  recircSec: number;
};

export type DoseCycleBreakdown = {
  dosingSec: number;
  recircSec: number;
  totalSec: number;
};

export function estimateEcCycleBreakdown(
  input: EstimateEcCycleInput
): DoseCycleBreakdown | null {
  const inter = input.interNutrientSec ?? 3;
  const parts = input.nutrients.filter((n) => n.ml > 0.001 && n.flowRateMlPerSec >= 0.01);
  if (parts.length === 0) return null;

  let dosingSec = 0;
  parts.forEach((n, i) => {
    if (i > 0) dosingSec += Math.max(0, inter);
    dosingSec += estimatePulsedDoseSec({
      totalMl: n.ml,
      pulseMl: input.pulseMl,
      pulseGapSec: input.pulseGapSec,
      flowRateMlPerSec: n.flowRateMlPerSec,
    });
  });

  const recircSec = Math.max(0, Math.floor(input.recircSec));
  const totalSec = dosingSec + recircSec;
  if (totalSec <= 0) return null;
  return { dosingSec, recircSec, totalSec };
}

export function estimateEcCycleSec(input: EstimateEcCycleInput): number | null {
  return estimateEcCycleBreakdown(input)?.totalSec ?? null;
}

export type EstimatePhCycleInput = {
  doseMl: number;
  flowRateMlPerSec: number;
  pulseMl: number;
  pulseGapSec: number;
  recircSec: number;
};

export function estimatePhCycleBreakdown(
  input: EstimatePhCycleInput
): DoseCycleBreakdown | null {
  if (input.doseMl <= 0.001 || input.flowRateMlPerSec < 0.01) return null;
  const dosingSec = estimatePulsedDoseSec({
    totalMl: input.doseMl,
    pulseMl: input.pulseMl,
    pulseGapSec: input.pulseGapSec,
    flowRateMlPerSec: input.flowRateMlPerSec,
  });
  const recircSec = Math.max(0, Math.floor(input.recircSec));
  const totalSec = dosingSec + recircSec;
  if (totalSec <= 0) return null;
  return { dosingSec, recircSec, totalSec };
}

export function estimatePhCycleSec(input: EstimatePhCycleInput): number | null {
  return estimatePhCycleBreakdown(input)?.totalSec ?? null;
}

/** Countdown con horas si ≥ 1 h (1:32:10 o 45:00 o 12s). */
export function formatCycleDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

/** Preview idle: "~1h45" / "~45min" / "~90s". */
export function formatCyclePreview(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  if (sec < 60) return `~${sec}s`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `~${hours}h${String(minutes).padStart(2, '0')}` : `~${hours}h`;
  }
  return `~${minutes}min`;
}
