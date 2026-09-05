import type { ScheduleBlock, ScheduleKind } from '@/lib/grow-cycle-timeline/types';

export type LiveScheduleRow = {
  id: string;
  device_id: string;
  rule_id: string;
  enabled: boolean;
  schedule_type: string;
  time_start: string;
  time_end: string | null;
  grow_week_index: number | null;
  created_by: string | null;
};

function formatTimeShort(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function inferKind(ruleId: string): ScheduleKind {
  const id = ruleId.toLowerCase();
  if (id.includes('circ')) return 'circulation';
  if (id.includes('uc') || id.includes('root') || id.includes('maint')) return 'maintenance';
  return 'custom';
}

/** Uma fila live → bloco visual (weekIndex = semana do grow_week, ou 0 se daily). */
export function liveScheduleToBlock(
  row: LiveScheduleRow,
  weekIndex: number
): ScheduleBlock {
  const time = formatTimeShort(row.time_start);
  const cadence =
    row.schedule_type === 'daily'
      ? `todo dia ${time}`
      : row.schedule_type === 'weekly'
        ? `semanal ${time}`
        : `${time}`;

  return {
    weekIndex,
    ruleId: row.rule_id,
    layer: 'P4',
    label: row.rule_id.replace(/^SCHEDULE_/, '').replace(/_/g, ' ') || row.rule_id,
    cadence,
    kind: inferKind(row.rule_id),
  };
}

/**
 * Expande schedules live para chips na timeline:
 * - grow_week → só na semana index
 * - daily → em todas as semanas 0..totalWeeks
 */
export function liveSchedulesToPlanBlocks(
  rows: LiveScheduleRow[],
  totalWeeks: number
): ScheduleBlock[] {
  const out: ScheduleBlock[] = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    if (row.schedule_type === 'grow_week' && row.grow_week_index != null) {
      out.push(liveScheduleToBlock(row, row.grow_week_index));
      continue;
    }
    if (row.schedule_type === 'daily') {
      for (let w = 0; w <= totalWeeks; w++) {
        out.push(liveScheduleToBlock(row, w));
      }
    }
  }
  return out;
}
