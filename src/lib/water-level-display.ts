import type { HwAccent, HwMetricVariant } from '@/lib/design-tokens';
import type { WaterLevelAggregate } from '@/hooks/useLevelSensors';

export const PROBE_COUNT = 4;

export const WATER_LEVEL_PT: Record<NonNullable<WaterLevelAggregate>, string> = {
  vazio: 'Vazio',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
};

export const PROBE_STATE_REACHED = 'Alcançado';
export const PROBE_STATE_NOT_REACHED = 'Não alcançado';

export type ProbeMeta = {
  index: number;
  shortLabel: string;
  positionHint: string | null;
};

/** L1 base → L4 topo (orden físico del tanque). */
export const PROBE_META: ProbeMeta[] = [
  { index: 1, shortLabel: 'Nível 1', positionHint: 'base' },
  { index: 2, shortLabel: 'Nível 2', positionHint: null },
  { index: 3, shortLabel: 'Nível 3', positionHint: null },
  { index: 4, shortLabel: 'Nível 4', positionHint: 'topo' },
];

/** Visualización UI: topo del tanque (L4) arriba, base (L1) abajo. */
export const PROBE_META_DISPLAY: ProbeMeta[] = [...PROBE_META].reverse();

export function getProbeValue(probes: (boolean | null)[], levelIndex: number): boolean | null {
  return probes[levelIndex - 1] ?? null;
}

export type ProbeCell = {
  text: string;
  variant: HwMetricVariant;
  accent: HwAccent;
  ledClass: string;
};

export function getProbeCell(wet: boolean | null): ProbeCell {
  if (wet === null) {
    return {
      text: '--',
      variant: 'default',
      accent: 'neutral',
      ledClass: 'bg-dark-border ring-1 ring-dark-border',
    };
  }
  if (wet) {
    return {
      text: PROBE_STATE_REACHED,
      variant: 'ok',
      accent: 'brand',
      ledClass: 'bg-aqua-400 shadow-[0_0_6px_rgba(38,198,218,0.45)]',
    };
  }
  return {
    text: PROBE_STATE_NOT_REACHED,
    variant: 'danger',
    accent: 'danger',
    ledClass: 'bg-red-500/90 shadow-[0_0_6px_rgba(248,113,113,0.35)]',
  };
}

export function getAggregateLabel(level: WaterLevelAggregate, isLoading = false): string {
  if (isLoading) return '…';
  if (!level) return '--';
  return WATER_LEVEL_PT[level] ?? level;
}

export function getAggregateBadgeAccent(level: WaterLevelAggregate): HwAccent {
  switch (level) {
    case 'vazio':
    case 'baixo':
      return 'danger';
    case 'medio':
      return 'warn';
    case 'alto':
      return 'ok';
    default:
      return 'neutral';
  }
}

export function getAggregateVariant(level: WaterLevelAggregate): HwMetricVariant {
  switch (level) {
    case 'vazio':
      return 'danger';
    case 'baixo':
      return 'alarm';
    case 'medio':
      return 'default';
    case 'alto':
      return 'ok';
    default:
      return 'default';
  }
}

export function getInterlockLabel(waterLevelOk: boolean | null): {
  text: string;
  accent: HwAccent;
  variant: HwMetricVariant;
} {
  if (waterLevelOk === null) {
    return { text: '--', accent: 'neutral', variant: 'default' };
  }
  if (waterLevelOk) {
    return { text: 'Liberado', accent: 'ok', variant: 'ok' };
  }
  return { text: 'Bloqueado', accent: 'danger', variant: 'alarm' };
}

export function countWetProbes(probes: (boolean | null)[]): number {
  return probes.filter((v) => v === true).length;
}

export function countKnownProbes(probes: (boolean | null)[]): number {
  return probes.filter((v) => v !== null).length;
}

/** 0–100 % para barra de llenado del mimic (4/4 → 100). */
export function deriveFillHeightPct(wetCount: number, total = PROBE_COUNT): number {
  if (total <= 0) return 0;
  return Math.round((Math.max(0, Math.min(wetCount, total)) / total) * 100);
}

export function formatTelemetryTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}                                       

export function hasLevelTelemetry(
  probes: (boolean | null)[],
  waterLevel: WaterLevelAggregate
): boolean {
  return probes.some((v) => v !== null) || waterLevel != null;
}
