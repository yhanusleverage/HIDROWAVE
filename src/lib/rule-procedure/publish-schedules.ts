import type { GrowCyclePlan, ScheduleBlock } from '@/lib/grow-cycle-timeline/types';
import type { ProcedureTrigger, RuleProcedure } from '@/lib/rule-procedure/types';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const P4_PRIORITY = 30;

export function parseCadenceToIntervalMs(cadence: string): number | null {
  const everyH = cadence.match(/every\s+(\d+)\s*h/i);
  if (everyH) {
    const hours = parseInt(everyH[1], 10);
    return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : null;
  }

  const everyMin = cadence.match(/every\s+(\d+)\s*min/i);
  if (everyMin) {
    const mins = parseInt(everyMin[1], 10);
    return Number.isFinite(mins) && mins > 0 ? mins * 60_000 : null;
  }

  return null;
}

export function parseCadenceToTimeWindow(
  cadence: string
): { start: string; end: string } | null {
  const domMatch = cadence.match(/Dom\s+(\d{1,2}):(\d{2})/i);
  if (domMatch) {
    const h = domMatch[1].padStart(2, '0');
    const m = domMatch[2].padStart(2, '0');
    const start = `${h}:${m}`;
    const endH = parseInt(domMatch[1], 10);
    const endM = parseInt(domMatch[2], 10) + 30;
    const end = `${String(endH + Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
    return { start, end };
  }
  return null;
}

export function scheduleToProcedure(
  sched: ScheduleBlock,
  plan: GrowCyclePlan,
  dedupeGlobal: boolean
): RuleProcedure {
  const triggers: ProcedureTrigger[] = [];
  const intervalMs = parseCadenceToIntervalMs(sched.cadence);
  const timeWin = parseCadenceToTimeWindow(sched.cadence);

  if (intervalMs != null) {
    triggers.push({ type: 'interval', everyMs: intervalMs });
  } else if (timeWin) {
    triggers.push({
      type: 'time_window',
      start: timeWin.start,
      end: timeWin.end,
      timezone: DEFAULT_TIMEZONE,
    });
  } else {
    triggers.push({
      type: 'time_window',
      start: '08:00',
      end: '09:00',
      timezone: DEFAULT_TIMEZONE,
    });
  }

  if (!dedupeGlobal) {
    triggers.push({ type: 'cycle_week', weekIndex: sched.weekIndex });
  }

  const procedureId = dedupeGlobal
    ? sched.ruleId
    : `${sched.ruleId}_W${String(sched.weekIndex).padStart(2, '0')}`;

  const pulseSeconds =
    sched.label.toLowerCase().includes('circ') || sched.ruleId.includes('circulation')
      ? 900
      : 600;

  return {
    id: procedureId,
    name: dedupeGlobal ? sched.label : `${sched.label} S${sched.weekIndex}`,
    description: `${sched.label} (${sched.cadence}) — plano ${plan.name}`,
    priority: P4_PRIORITY,
    layer: 'P4',
    enabled: true,
    triggers,
    steps: [
      {
        type: 'set_relay',
        id: `${procedureId}-pulse`,
        label: sched.label,
        actuator: {
          target: 'master',
          relayIndex: 1,
          label: sched.label,
        },
        state: 'on',
        durationSeconds: pulseSeconds,
      },
    ],
  };
}

/** Deduplica schedules globais (ex. circulação 2h em todas as semanas). */
export function buildSchedulesFromGrowPlan(plan: GrowCyclePlan): RuleProcedure[] {
  const byKey = new Map<string, ScheduleBlock>();

  for (const sched of plan.schedules ?? []) {
    if (sched.weekIndex > plan.totalWeeks) continue;

    const intervalMs = parseCadenceToIntervalMs(sched.cadence);
    const isGlobalInterval = intervalMs != null && sched.ruleId.includes('circulation');
    const key = isGlobalInterval ? `${sched.ruleId}:${sched.cadence}` : `${sched.ruleId}:${sched.cadence}:W${sched.weekIndex}`;

    if (!byKey.has(key)) {
      byKey.set(key, sched);
    }
  }

  return Array.from(byKey.values()).map((sched) => {
    const dedupeGlobal = sched.ruleId.includes('circulation');
    return scheduleToProcedure(sched, plan, dedupeGlobal);
  });
}
