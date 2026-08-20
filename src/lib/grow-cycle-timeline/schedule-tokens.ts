import type { ScheduleBlock, ScheduleKind } from './types';
import type { HwAccent } from '@/lib/design-tokens';
import {
  HW_ACCENT_LEFT,
  HW_BADGE,
  HW_BG_SUBTLE,
  HW_TEXT,
} from '@/lib/design-tokens';

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  circulation: 'Circulação',
  maintenance: 'Manutenção',
  custom: 'Agendamento',
};

export const SCHEDULE_KIND_ACCENT: Record<ScheduleKind, HwAccent> = {
  circulation: 'wait',
  maintenance: 'brand',
  custom: 'neutral',
};

/** Infer schedule kind from ruleId/label when `kind` is absent (backward compat). */
export function resolveScheduleKind(block: ScheduleBlock): ScheduleKind {
  if (block.kind) return block.kind;
  const id = block.ruleId.toLowerCase();
  const label = block.label.toLowerCase();
  if (id.includes('circulation') || label.includes('circula')) return 'circulation';
  if (id.includes('uc') || id.includes('roots') || label.includes('uc')) return 'maintenance';
  return 'custom';
}

export function scheduleAccent(kind: ScheduleKind): HwAccent {
  return SCHEDULE_KIND_ACCENT[kind];
}

export function scheduleChipClasses(kind: ScheduleKind): string {
  const accent = scheduleAccent(kind);
  return `${HW_BADGE[accent]} border ${HW_ACCENT_LEFT[accent]} border-l-2`;
}

export function scheduleTextClass(kind: ScheduleKind): string {
  return HW_TEXT[scheduleAccent(kind)];
}

export function scheduleSubtleBgClass(kind: ScheduleKind): string {
  return HW_BG_SUBTLE[scheduleAccent(kind)];
}

/** Compact cadence label for chart chips. */
export function scheduleCadenceShort(block: ScheduleBlock): string {
  const kind = resolveScheduleKind(block);
  if (kind === 'circulation') {
    const m = block.cadence.match(/every\s+(\d+h?)/i);
    if (m) return m[1].replace(/h$/i, 'h');
    return block.cadence;
  }
  if (kind === 'maintenance') {
    if (block.cadence.toLowerCase().includes('dom')) return 'Dom';
    return block.cadence.split(' ')[0] ?? block.cadence;
  }
  return block.cadence.length > 8 ? `${block.cadence.slice(0, 7)}…` : block.cadence;
}

/** Whether schedule runs continuously through the week (mini-bar dashed). */
export function scheduleIsRecurring(kind: ScheduleKind): boolean {
  return kind === 'circulation';
}
