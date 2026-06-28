import type { GrowCyclePlan, GrowWeekProfile, ScheduleBlock, TankEvent } from './types';

function week(
  weekIndex: number,
  phase: GrowWeekProfile['phase'],
  ecSetpointUsCm: number,
  phSetpoint: number,
  label?: string
): GrowWeekProfile {
  return { weekIndex, phase, ecSetpointUsCm, phSetpoint, label };
}

function changeoutEvent(fromWeek: number): TankEvent {
  const toWeek = fromWeek + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    kind: 'changeout',
    weekIndex: fromWeek,
    triggerTime: '08:00',
    ruleIdSuggested: `CHANGEOUT_W${pad(fromWeek)}_W${pad(toWeek)}`,
    priority: 85,
    layer: 'P1',
    description: `Changeout semanal S${fromWeek}→S${toWeek} (dreno 50% + reposição)`,
  };
}

const weeks: GrowWeekProfile[] = [
  week(0, 'establishment', 800, 5.8, 'Initial Fill'),
  week(1, 'vegetative', 900, 5.8),
  week(2, 'vegetative', 1000, 5.8),
  week(3, 'vegetative', 1100, 5.8),
  week(4, 'vegetative', 1200, 5.8),
  week(5, 'flip', 1400, 6.0, 'Flip'),
  week(6, 'flower', 1600, 6.1),
  week(7, 'flower', 1650, 6.15),
  week(8, 'flower', 1700, 6.2),
  week(9, 'flower', 1750, 6.25),
  week(10, 'flower', 1780, 6.28),
  week(11, 'flower', 1800, 6.3),
  week(12, 'flush', 400, 5.5, 'Flush + Drain'),
];

const tankEvents: TankEvent[] = [
  {
    kind: 'initial_fill',
    weekIndex: 0,
    triggerTime: '08:00',
    ruleIdSuggested: 'INITIAL_FILL',
    priority: 90,
    layer: 'P1',
    description: 'Initial Fill and Dose — enchimento 80% + delay mix',
  },
  ...weeks.slice(1, 12).map((_, i) => changeoutEvent(i + 1)),
  {
    kind: 'drain_full',
    weekIndex: 12,
    triggerTime: '08:00',
    ruleIdSuggested: 'DRAIN_FULL',
    priority: 95,
    layer: 'P1',
    description: 'Drain total fim de ciclo — desativar Auto EC/pH manual',
  },
];

const schedules: ScheduleBlock[] = weeks.flatMap((w) => [
  {
    weekIndex: w.weekIndex,
    ruleId: 'SCHEDULE_circulation',
    layer: 'P4',
    label: 'Circulação',
    cadence: 'every 2h',
  },
  ...(w.weekIndex >= 1 && w.weekIndex % 7 === 0
    ? [
        {
          weekIndex: w.weekIndex,
          ruleId: 'SCHEDULE_uc_roots',
          layer: 'P4' as const,
          label: 'UC Roots',
          cadence: 'Dom 10:00',
        },
      ]
    : []),
]);

/** Ciclo RDWC demo — 12 semanas (S0–S12). Dados fictícios para preview. */
export const MOCK_RDWC_12W_PLAN: GrowCyclePlan = {
  id: 'mock-rdwc-12w',
  name: 'RDWC Demo — 12 semanas',
  description:
    'Plano simulado: estabelecimento, veg, flip, flower e flush. Changeout semanal P1 @ 08:00.',
  totalWeeks: 12,
  weeks,
  tankEvents,
  schedules,
  autoEcPhEnabled: true,
};
