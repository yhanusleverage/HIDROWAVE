/**
 * Preview de u(t) Auto EC alineado al firmware / AutoEcControllerPanel.
 */

export type EcDoseNutrient = {
  mlPerLiter: number;
  flowRate?: number | null;
};

export type EstimateEcDoseMlInput = {
  volumeL: number;
  baseDose: number;
  ecSetpoint: number;
  ecActual: number;
  tolerance: number;
  aggressiveness: number;
  nutrients: EcDoseNutrient[];
  minMlPerLiter?: number;
};

export type EcDoseSplit = {
  totalMl: number;
  parts: { ml: number; flowRateMlPerSec: number }[];
};

export function estimateEcDoseSplit(input: EstimateEcDoseMlInput): EcDoseSplit | null {
  const minMl = input.minMlPerLiter ?? 0.01;
  const active = input.nutrients.filter((n) => (n.mlPerLiter ?? 0) >= minMl);
  const totalMlPerLiter = active.reduce((s, n) => s + n.mlPerLiter, 0);
  if (
    totalMlPerLiter <= 0 ||
    input.baseDose <= 0 ||
    input.volumeL <= 0 ||
    input.ecActual == null ||
    !Number.isFinite(input.ecActual)
  ) {
    return null;
  }

  const error = Math.max(0, input.ecSetpoint - input.ecActual);
  if (error <= input.tolerance) {
    return null;
  }

  const k = input.baseDose / totalMlPerLiter;
  if (k <= 0) return null;
  const totalMl = (input.volumeL / k) * error * input.aggressiveness;
  if (totalMl <= 0.001) return null;

  const parts = active
    .map((n) => {
      const ml = totalMl * (n.mlPerLiter / totalMlPerLiter);
      const q = Number(n.flowRate) || 0;
      return { ml, flowRateMlPerSec: q };
    })
    .filter((p) => p.ml > 0.001 && p.flowRateMlPerSec >= 0.01);

  if (parts.length === 0) return null;
  return { totalMl, parts };
}
