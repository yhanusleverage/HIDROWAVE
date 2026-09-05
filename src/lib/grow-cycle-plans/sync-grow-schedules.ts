/**
 * Materializa plan.schedules → rule_schedules (grow_week) ao iniciar ciclo.
 * Não apaga schedules manuais (created_by ≠ grow-cycle-publish).
 */

import { getSupabaseServerClient } from '@/lib/supabase-server';
import type { GrowCyclePlan, ScheduleBlock } from '@/lib/grow-cycle-timeline/types';

export const GROW_CYCLE_SCHEDULE_CREATED_BY = 'grow-cycle-publish';

/** Extrai HH:MM de cadence ("Dom 10:00", "every 2h", "08:00") — default 08:00. */
export function cadenceToTimeStart(cadence: string): string {
  const m = cadence.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return '08:00';
}

function scheduleRow(deviceId: string, block: ScheduleBlock) {
  return {
    device_id: deviceId,
    rule_id: block.ruleId,
    schedule_type: 'grow_week' as const,
    time_start: cadenceToTimeStart(block.cadence),
    grow_week_index: block.weekIndex,
    timezone: 'America/Sao_Paulo',
    enabled: true,
    created_by: GROW_CYCLE_SCHEDULE_CREATED_BY,
  };
}

export async function syncGrowCycleSchedulesFromPlan(
  deviceId: string,
  plan: GrowCyclePlan
): Promise<{ upserted: number; warnings: string[] }> {
  const warnings: string[] = [];
  const sb = getSupabaseServerClient();
  const id = deviceId.trim();

  const { error: delErr } = await sb
    .from('rule_schedules')
    .delete()
    .eq('device_id', id)
    .eq('created_by', GROW_CYCLE_SCHEDULE_CREATED_BY);

  if (delErr) {
    warnings.push(`schedules cleanup: ${delErr.message}`);
  }

  const blocks = plan.schedules ?? [];
  if (blocks.length === 0) {
    return { upserted: 0, warnings };
  }

  const rows = blocks.map((b) => scheduleRow(id, b));
  const { error: insErr } = await sb.from('rule_schedules').insert(rows);
  if (insErr) {
    warnings.push(`schedules insert: ${insErr.message}`);
    return { upserted: 0, warnings };
  }

  return { upserted: rows.length, warnings };
}
