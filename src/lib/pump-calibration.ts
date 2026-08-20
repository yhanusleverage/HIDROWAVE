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

export function roundFlowRateMlPerSec(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function parseNutrientFlowRate(n: {
  flowRate?: unknown;
  flow_rate?: unknown;
}): number | undefined {
  const v = Number(n.flowRate ?? n.flow_rate);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** HMI DoseChannel R1–R6 → relés web 0–5. */
export const HMI_PUMP_COUNT = 6;

export type NutrientFlowRow = {
  name?: string;
  relay?: number;
  relayNumber?: number;
  mlPerLiter?: number;
  active?: boolean;
  flowRate?: number;
};

export function nutrientRelayNumber(n: NutrientFlowRow): number | null {
  const r = Number(n.relay ?? n.relayNumber);
  if (!Number.isFinite(r) || r < 0) return null;
  return Math.trunc(r);
}

export function upsertPumpFlowRate(
  nutrients: NutrientFlowRow[],
  relay: number,
  flowRate: number,
  name: string
): NutrientFlowRow[] {
  const q = roundFlowRateMlPerSec(flowRate);
  let found = false;
  const next = nutrients.map((n) => {
    if (nutrientRelayNumber(n) !== relay) return n;
    found = true;
    return { ...n, flowRate: q };
  });
  if (!found) {
    next.push({ name, relay, mlPerLiter: 0, active: false, flowRate: q });
  }
  return next;
}

/** Conserva vazão por relé quando Automação regrava a tabela nutricional. */
export function mergeNutrientFlowRates(
  existing: NutrientFlowRow[],
  nextActive: NutrientFlowRow[]
): NutrientFlowRow[] {
  const flowByRelay = new Map<number, number>();
  const ghosts: NutrientFlowRow[] = [];
  for (const n of existing) {
    const r = nutrientRelayNumber(n);
    const q = parseNutrientFlowRate(n);
    if (r == null) continue;
    if (q) flowByRelay.set(r, q);
    if ((Number(n.mlPerLiter) || 0) < 0.1 && q) ghosts.push(n);
  }
  const used = new Set<number>();
  const out: NutrientFlowRow[] = nextActive.map((n) => {
    const r = nutrientRelayNumber(n) ?? 0;
    used.add(r);
    const q = parseNutrientFlowRate(n) ?? flowByRelay.get(r);
    return q ? { ...n, flowRate: q } : n;
  });
  for (const g of ghosts) {
    const r = nutrientRelayNumber(g);
    if (r == null || used.has(r)) continue;
    out.push({
      ...g,
      name: g.name || `Bomba ${r + 1}`,
      relay: r,
      mlPerLiter: 0,
      active: false,
      flowRate: parseNutrientFlowRate(g),
    });
  }
  return out;
}
