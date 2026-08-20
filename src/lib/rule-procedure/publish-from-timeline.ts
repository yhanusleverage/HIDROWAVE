import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import type { RuleProcedure } from './types';
import { compileProcedureToPayload } from './compile-procedure';
import { buildSchedulesFromGrowPlan } from './publish-schedules';

export { buildSchedulesFromGrowPlan, scheduleToProcedure } from './publish-schedules';

function tankEventToProcedure(event: GrowCyclePlan['tankEvents'][number], plan: GrowCyclePlan): RuleProcedure {
  const week = plan.weeks.find((w) => w.weekIndex === event.weekIndex);
  const name =
    event.kind === 'initial_fill'
      ? 'Initial Fill and Dose'
      : event.kind === 'drain_full'
        ? 'Drain Full'
        : `Changeout S${event.weekIndex}`;

  return {
    id: event.ruleIdSuggested,
    name,
    description: event.description,
    priority: event.priority,
    layer: 'P1',
    enabled: true,
    triggers: [
      {
        type: 'time_window',
        start: event.triggerTime,
        end: '09:00',
        timezone: 'America/Sao_Paulo',
      },
      { type: 'cycle_week', weekIndex: event.weekIndex },
    ],
    steps: [
      {
        type: 'sensor_valve',
        id: `${event.ruleIdSuggested}-valve`,
        label: event.description,
        actuator: { target: 'master', relayIndex: 0, label: 'Fill/Drain valve' },
        sensor: {
          sensor: 'water_level',
          operator: '>',
          value: week?.weekIndex === 0 ? 80 : 50,
        },
        valveStart: event.kind === 'drain_full' ? 'open' : 'closed',
        valveFinish: 'open',
        maxDurationMs: 600_000,
      },
      {
        type: 'wait',
        id: `${event.ruleIdSuggested}-mix`,
        label: 'Mix delay',
        durationMs: 300_000,
      },
    ],
  };
}

export function buildProceduresFromGrowPlan(plan: GrowCyclePlan): RuleProcedure[] {
  const p1 = plan.tankEvents
    .filter((e) => e.weekIndex <= plan.totalWeeks)
    .map((e) => tankEventToProcedure(e, plan));
  const p4 = buildSchedulesFromGrowPlan(plan);
  return [...p1, ...p4];
}

export function compileGrowPlanPublishPayload(plan: GrowCyclePlan) {
  const procedures = buildProceduresFromGrowPlan(plan);
  return procedures.map((p) => ({
    procedure: p,
    compiled: compileProcedureToPayload(p),
  }));
}
