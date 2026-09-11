import type { ProcedureStep } from './types';

export function newProcedureStepId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createProcedureStep(type: ProcedureStep['type']): ProcedureStep {
  const id = newProcedureStepId();
  switch (type) {
    case 'sensor_valve':
      return {
        type: 'sensor_valve',
        id,
        label: '',
        actuator: { target: 'slave', relayIndex: 3, slaveMac: '' },
        // enquanto não for vazio (dreno típico)
        sensor: { sensor: 'water_level', operator: '!=', value: 'vazio' },
        conditionSemantics: 'while',
        valveStart: 'open',
        valveFinish: 'closed',
        maxDurationMs: 30 * 60 * 1000,
      };
    case 'set_relay':
      return {
        type: 'set_relay',
        id,
        label: '',
        actuator: { target: 'master', relayIndex: 0 },
        state: 'on',
        durationSeconds: 0,
      };
    case 'wait':
      return { type: 'wait', id, label: '', durationMs: 5000 };
    case 'hold_chemical':
      return { type: 'hold_chemical', id, enabled: true };
    case 'invoke_rule':
      return {
        type: 'invoke_rule',
        id,
        targetRuleId: 'fn_recirculacao_continua',
        on: 'success',
        delayMs: 0,
      };
    default:
      return { type: 'wait', id, durationMs: 1000 };
  }
}
