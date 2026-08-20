import type {
  ActuatorRef,
  ProcedureChainLink,
  ProcedureStep,
  ProcedureTrigger,
  RuleProcedure,
  SensorCondition,
} from './types';
import {
  getHydraulicRoleDefinition,
  isHydraulicRolesMapCompleteForProcedure,
  resolveActuator,
  rolesUsedByProcedure,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';

export interface CompiledScriptInstruction {
  type: string;
  condition?: { sensor: string; operator: string; value: string | number };
  body?: CompiledScriptInstruction[];
  relay_number?: number;
  action?: 'on' | 'off' | 'toggle';
  target?: 'master' | 'slave';
  slave_mac?: string;
  duration_seconds?: number;
  duration_ms?: number;
  delay_ms?: number;
  max_iterations?: number;
}

export interface ProcedureCompilePayload {
  procedureId: string;
  procedureName: string;
  layer: RuleProcedure['layer'];
  priority: number;
  enabled: boolean;
  triggers: ProcedureTrigger[];
  rule_json: {
    priority: number;
    procedure_ref: { id: string; layer: RuleProcedure['layer'] };
    procedure_triggers?: ProcedureTrigger[];
    script: {
      instructions: CompiledScriptInstruction[];
      loop_interval_ms: number;
      max_iterations: number;
      chained_events?: Array<{
        target_rule_id: string;
        trigger_on: 'success' | 'failure';
        delay_ms: number;
      }>;
    };
  };
}

function whileConditionForSensorValve(sensor: SensorCondition): SensorCondition {
  const map: Record<SensorCondition['operator'], SensorCondition['operator']> = {
    '>': '<=',
    '>=': '<',
    '<': '>=',
    '<=': '>',
    '==': '!=',
    '!=': '==',
  };
  return {
    sensor: sensor.sensor,
    operator: map[sensor.operator] ?? '<=',
    value: sensor.value,
  };
}

function relayInstruction(
  actuator: ActuatorRef,
  state: 'on' | 'off',
  durationSeconds?: number
): CompiledScriptInstruction {
  const instr: CompiledScriptInstruction = {
    type: 'relay_action',
    relay_number: actuator.relayIndex,
    action: state,
    target: actuator.target,
  };
  if (actuator.target === 'slave' && actuator.slaveMac) {
    instr.slave_mac = actuator.slaveMac;
  }
  if (durationSeconds != null && durationSeconds > 0) {
    instr.duration_seconds = durationSeconds;
  }
  return instr;
}

function compileStep(step: ProcedureStep): CompiledScriptInstruction[] {
  switch (step.type) {
    case 'sensor_valve': {
      const openState = step.valveStart === 'open' ? 'on' : 'off';
      const closeState = step.valveFinish === 'open' ? 'on' : 'off';
      const maxSec = Math.max(1, Math.ceil(step.maxDurationMs / 1000));
      return [
        {
          type: 'while',
          condition: whileConditionForSensorValve(step.sensor),
          max_iterations: maxSec,
          body: [relayInstruction(step.actuator, openState)],
        },
        relayInstruction(step.actuator, closeState),
      ];
    }
    case 'set_relay':
      return [relayInstruction(step.actuator, step.state, step.durationSeconds)];
    case 'wait':
      return [{ type: 'delay', duration_ms: step.durationMs, delay_ms: step.durationMs }];
    case 'hold_chemical':
      return [];
    case 'invoke_rule':
      return [];
    default:
      return [];
  }
}

function compileChain(
  chain: ProcedureChainLink[] | undefined
): ProcedureCompilePayload['rule_json']['script']['chained_events'] {
  if (!chain?.length) return undefined;
  return chain.map((link) => ({
    target_rule_id: link.targetRuleId,
    trigger_on: link.on,
    delay_ms: link.delayMs,
  }));
}

function compileInvokeSteps(steps: ProcedureStep[]): ProcedureChainLink[] {
  const links: ProcedureChainLink[] = [];
  for (const step of steps) {
    if (step.type === 'invoke_rule') {
      links.push({
        targetRuleId: step.targetRuleId,
        on: step.on,
        delayMs: step.delayMs ?? 0,
      });
    }
  }
  return links;
}

export function materializeProcedureHydraulicRoles(
  procedure: RuleProcedure,
  roles: HydraulicRolesMap
): { procedure: RuleProcedure; errors: string[] } {
  const errors = isHydraulicRolesMapCompleteForProcedure(
    roles,
    rolesUsedByProcedure(procedure.steps)
  );

  const steps = procedure.steps.map((step) => {
    if (step.type !== 'sensor_valve' && step.type !== 'set_relay') return step;
    if (!step.roleId) return step;

    const actuator = resolveActuator(step.roleId, roles);
    if (!actuator) {
      const label = getHydraulicRoleDefinition(step.roleId)?.label ?? step.roleId;
      errors.push(`Tipagem em falta para "${label}"`);
      return step;
    }
    return { ...step, actuator };
  });

  return {
    procedure: { ...procedure, steps },
    errors: [...new Set(errors)],
  };
}

export function compileProcedureToPayload(
  procedure: RuleProcedure,
  hydraulicRoles?: HydraulicRolesMap
): ProcedureCompilePayload {
  let resolved = procedure;
  if (hydraulicRoles) {
    const materialized = materializeProcedureHydraulicRoles(procedure, hydraulicRoles);
    if (materialized.errors.length > 0) {
      throw new Error(materialized.errors.join('; '));
    }
    resolved = materialized.procedure;
  }

  const instructions: CompiledScriptInstruction[] = [];
  for (const step of resolved.steps) {
    if (step.type === 'invoke_rule') continue;
    instructions.push(...compileStep(step));
  }

  const chainFromProcedure = procedure.chain ?? [];
  const chainFromSteps = compileInvokeSteps(procedure.steps);
  const chained = compileChain([...chainFromProcedure, ...chainFromSteps]);

  const script: ProcedureCompilePayload['rule_json']['script'] = {
    instructions,
    loop_interval_ms: 1000,
    max_iterations: 0,
    chained_events: chained,
  };

  return {
    procedureId: resolved.id,
    procedureName: resolved.name,
    layer: resolved.layer,
    priority: resolved.priority,
    enabled: resolved.enabled,
    triggers: resolved.triggers,
    rule_json: {
      priority: resolved.priority,
      procedure_ref: { id: resolved.id, layer: resolved.layer },
      procedure_triggers: resolved.triggers,
      script,
    },
  };
}
