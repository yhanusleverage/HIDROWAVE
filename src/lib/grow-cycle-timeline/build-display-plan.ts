import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import { MOCK_RDWC_12W_PLAN } from '@/lib/grow-cycle-timeline/mock-rdwc-12w';

/** Receita completa (demo / setpoints EC-pH). */
export function buildRecipePlan(totalWeeks: number): GrowCyclePlan {
  const tw = Math.max(1, Math.min(14, totalWeeks));
  return {
    ...MOCK_RDWC_12W_PLAN,
    totalWeeks: tw,
    weeks: MOCK_RDWC_12W_PLAN.weeks.filter((w) => w.weekIndex <= tw),
    tankEvents: MOCK_RDWC_12W_PLAN.tankEvents.filter((e) => e.weekIndex <= tw),
    schedules: MOCK_RDWC_12W_PLAN.schedules.filter((s) => s.weekIndex <= tw),
  };
}

/**
 * Ciclo live ao arrancar: setpoints + eventos de tanque da receita (FILL/CO/DRAIN),
 * schedules do plano vazios até o grower criar live (ou merge na UI).
 */
export function buildLiveEmptyDisplayPlan(recipe: GrowCyclePlan): GrowCyclePlan {
  return {
    ...recipe,
    schedules: [],
  };
}

/**
 * Publish ao Iniciar ciclo: setpoints + P1 da receita opcional;
 * schedules do plano NÃO materializam (ciclo começa vazio no live).
 */
export function buildStartCyclePublishPlan(recipe: GrowCyclePlan): GrowCyclePlan {
  return {
    ...recipe,
    schedules: [],
  };
}
