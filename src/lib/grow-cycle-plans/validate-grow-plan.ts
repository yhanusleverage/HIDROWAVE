import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';

export interface GrowPlanValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGrowCyclePlan(plan: GrowCyclePlan): GrowPlanValidationResult {
  const errors: string[] = [];

  if (!plan.id?.trim()) errors.push('plan.id é obrigatório');
  if (!plan.name?.trim()) errors.push('plan.name é obrigatório');
  if (!Number.isInteger(plan.totalWeeks) || plan.totalWeeks < 1 || plan.totalWeeks > 14) {
    errors.push('totalWeeks deve estar entre 1 e 14');
  }

  if (!Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    errors.push('weeks não pode estar vazio');
  } else {
    const indices = plan.weeks.map((w) => w.weekIndex).sort((a, b) => a - b);
    for (let i = 0; i <= plan.totalWeeks; i++) {
      if (!indices.includes(i)) {
        errors.push(`weeks falta weekIndex ${i}`);
      }
    }
    for (const w of plan.weeks) {
      if (w.weekIndex < 0 || w.weekIndex > plan.totalWeeks) {
        errors.push(`weekIndex ${w.weekIndex} fora do intervalo 0–${plan.totalWeeks}`);
      }
      if (!Number.isFinite(w.ecSetpointUsCm) || w.ecSetpointUsCm < 0) {
        errors.push(`EC setpoint inválido na semana ${w.weekIndex}`);
      }
      if (!Number.isFinite(w.phSetpoint) || w.phSetpoint <= 0) {
        errors.push(`pH setpoint inválido na semana ${w.weekIndex}`);
      }
    }
  }

  for (const ev of plan.tankEvents ?? []) {
    if (ev.weekIndex < 0 || ev.weekIndex > plan.totalWeeks) {
      errors.push(`tankEvent ${ev.ruleIdSuggested} weekIndex fora do intervalo`);
    }
    if (!ev.ruleIdSuggested?.trim()) {
      errors.push('tankEvent sem ruleIdSuggested');
    }
    if (ev.priority < 80 || ev.priority > 100) {
      errors.push(`tankEvent ${ev.ruleIdSuggested}: priority P1 sugerida 80–95`);
    }
  }

  for (const sched of plan.schedules ?? []) {
    if (sched.weekIndex < 0 || sched.weekIndex > plan.totalWeeks) {
      errors.push(`schedule ${sched.ruleId} weekIndex fora do intervalo`);
    }
    if (!sched.ruleId?.trim()) errors.push('schedule sem ruleId');
    if (!sched.cadence?.trim()) errors.push(`schedule ${sched.ruleId} sem cadence`);
  }

  return { valid: errors.length === 0, errors };
}
