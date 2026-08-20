import {
  LAYER_PRIORITY_HINT,
  type ActuatorRef,
  type ProcedureStep,
  type ProcedureTrigger,
  type RuleProcedure,
} from './types';
import {
  isHydraulicRolesMapCompleteForProcedure,
  rolesUsedByProcedure,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';

export interface ProcedureValidationOptions {
  hydraulicRoles?: HydraulicRolesMap;
}

export interface ProcedureValidationResult {
  valid: boolean;
  errors: string[];
}

function validateActuator(actuator: ActuatorRef, path: string, errors: string[]): void {
  if (actuator.target !== 'master' && actuator.target !== 'slave') {
    errors.push(`${path}.actuator.target invalido`);
  }
  if (!Number.isInteger(actuator.relayIndex) || actuator.relayIndex < 0 || actuator.relayIndex > 7) {
    errors.push(`${path}.actuator.relayIndex deve ser 0-7`);
  }
  if (actuator.target === 'slave' && (!actuator.slaveMac || actuator.slaveMac.trim() === '')) {
    errors.push(`${path}.actuator.slaveMac e obrigatorio para target slave`);
  }
}

function validateTrigger(trigger: ProcedureTrigger, index: number, errors: string[]): void {
  const p = `triggers[${index}]`;
  switch (trigger.type) {
    case 'time_window':
      if (!trigger.start?.trim()) errors.push(`${p}.start e obrigatorio`);
      if (!trigger.end?.trim()) errors.push(`${p}.end e obrigatorio`);
      break;
    case 'interval':
      if (typeof trigger.everyMs !== 'number' || trigger.everyMs <= 0) {
        errors.push(`${p}.everyMs deve ser > 0`);
      }
      break;
    case 'cycle_week':
      if (!Number.isInteger(trigger.weekIndex) || trigger.weekIndex < 0) {
        errors.push(`${p}.weekIndex invalido`);
      }
      break;
    case 'manual':
      break;
    default:
      errors.push(`${p}.type desconhecido`);
  }
}

function validateStep(
  step: ProcedureStep,
  index: number,
  errors: string[],
  hydraulicRoles?: HydraulicRolesMap
): void {
  const p = `steps[${index}]`;
  if (!step.id?.trim()) errors.push(`${p}.id e obrigatorio`);

  switch (step.type) {
    case 'sensor_valve':
      if (step.roleId) {
        if (!hydraulicRoles?.[step.roleId]) {
          errors.push(`${p}: tipagem em falta para ${step.roleId}`);
        }
      } else {
        validateActuator(step.actuator, p, errors);
      }
      if (!step.sensor.sensor?.trim()) errors.push(`${p}.sensor.sensor e obrigatorio`);
      if (step.maxDurationMs <= 0) errors.push(`${p}.maxDurationMs deve ser > 0`);
      break;
    case 'set_relay':
      if (step.roleId) {
        if (!hydraulicRoles?.[step.roleId]) {
          errors.push(`${p}: tipagem em falta para ${step.roleId}`);
        }
      } else {
        validateActuator(step.actuator, p, errors);
      }
      if (step.state !== 'on' && step.state !== 'off') errors.push(`${p}.state invalido`);
      break;
    case 'wait':
      if (step.durationMs <= 0) errors.push(`${p}.durationMs deve ser > 0`);
      break;
    case 'hold_chemical':
      break;
    case 'invoke_rule':
      if (!step.targetRuleId?.trim()) errors.push(`${p}.targetRuleId e obrigatorio`);
      break;
    default:
      errors.push(`${p}.type desconhecido`);
  }
}

export function validateProcedure(
  procedure: RuleProcedure,
  options?: ProcedureValidationOptions
): ProcedureValidationResult {
  const errors: string[] = [];
  const hydraulicRoles = options?.hydraulicRoles;

  if (!procedure.id?.trim()) errors.push('id e obrigatorio');
  if (!procedure.name?.trim()) errors.push('name e obrigatorio');
  if (!Number.isFinite(procedure.priority) || procedure.priority < 0 || procedure.priority > 100) {
    errors.push('priority deve estar entre 0 e 100');
  }

  const hint = LAYER_PRIORITY_HINT[procedure.layer];
  if (hint && (procedure.priority < hint.min || procedure.priority > hint.max)) {
    errors.push(
      `priority ${procedure.priority} fora da faixa sugerida para ${procedure.layer} (${hint.min}-${hint.max})`
    );
  }

  if (!Array.isArray(procedure.triggers) || procedure.triggers.length === 0) {
    errors.push('triggers deve ter pelo menos um item');
  } else {
    procedure.triggers.forEach((t, i) => validateTrigger(t, i, errors));
  }

  if (!Array.isArray(procedure.steps) || procedure.steps.length === 0) {
    errors.push('steps deve ter pelo menos um item');
  } else {
    procedure.steps.forEach((s, i) => validateStep(s, i, errors, hydraulicRoles));
    if (hydraulicRoles && procedure.layer === 'P1') {
      const usedRoles = rolesUsedByProcedure(procedure.steps);
      errors.push(...isHydraulicRolesMapCompleteForProcedure(hydraulicRoles, usedRoles));
    }
  }

  procedure.chain?.forEach((link, i) => {
    if (!link.targetRuleId?.trim()) errors.push(`chain[${i}].targetRuleId e obrigatorio`);
    if (typeof link.delayMs !== 'number' || link.delayMs < 0) {
      errors.push(`chain[${i}].delayMs deve ser >= 0`);
    }
  });

  return { valid: errors.length === 0, errors };
}
