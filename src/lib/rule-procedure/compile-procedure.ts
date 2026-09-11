import type {
  ActuatorRef,
  HydraulicRoleId,
  ProcedureChainLink,
  ProcedureStep,
  ProcedureTrigger,
  RuleProcedure,
  SensorCondition,
} from './types';
import {
  getHydraulicRoleDefinition,
  resolveActuator,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import { repairProcedureSteps } from '@/lib/rule-procedure/repair-sensor-valve';

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
    execution_class?: 'simple' | 'procedure';
    procedure_kind?: 'full_recharge' | 'drain_only' | 'fill_only' | 'generic' | 'simple';
    procedure_ref: { id: string; layer: RuleProcedure['layer'] };
    procedure_triggers?: ProcedureTrigger[];
    procedure_steps?: ProcedureStep[];
    /** FSM v2 — Master TankProcedureFsm (evita infer frágil do script). */
    fsm?: {
      hold_chemical?: boolean;
      drain?: {
        relay: number;
        relay_number: number;
        until: string;
        timeout_s: number;
        slave_mac?: string;
        target?: 'master' | 'slave';
      };
      fill?: {
        relay: number;
        relay_number: number;
        until: string;
        timeout_s: number;
        slave_mac?: string;
        target?: 'master' | 'slave';
      };
    };
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

/** Clasifica script compilado para historial Simple vs Procedure. */
export function classifyCompiledScript(
  instructions: CompiledScriptInstruction[]
): {
  execution_class: 'simple' | 'procedure';
  procedure_kind: 'full_recharge' | 'drain_only' | 'fill_only' | 'generic' | 'simple';
} {
  let hasWhile = false;
  let hasWaitLike = false;
  let drain = false;
  let fill = false;

  const walk = (list: CompiledScriptInstruction[]) => {
    for (const ins of list) {
      if (ins.type === 'while') {
        hasWhile = true;
        if (ins.body) walk(ins.body);
      }
      if (
        ins.type === 'wait_level' ||
        ins.type === 'wait_liters' ||
        ins.type === 'recirc' ||
        ins.type === 'block_auto'
      ) {
        hasWaitLike = true;
      }
      const role = (ins as { role?: string }).role;
      if (role === 'drain') drain = true;
      if (role === 'fill') fill = true;
      // Heurística sensor_valve: while sobre water_level + relay
      const sensor = ins.condition?.sensor;
      if (sensor === 'water_level' || (typeof sensor === 'string' && sensor.startsWith('level_'))) {
        hasWhile = true;
      }
    }
  };
  walk(instructions);

  // Pasos sensor_valve del builder ⇒ procedure aunque no haya role
  const looksProcedure = hasWhile || hasWaitLike;
  if (!looksProcedure) {
    return { execution_class: 'simple', procedure_kind: 'simple' };
  }
  if (drain && fill) {
    return { execution_class: 'procedure', procedure_kind: 'full_recharge' };
  }
  if (drain) return { execution_class: 'procedure', procedure_kind: 'drain_only' };
  if (fill) return { execution_class: 'procedure', procedure_kind: 'fill_only' };
  // Builder sensor_valve (dreno/fill) sin role explícito
  return { execution_class: 'procedure', procedure_kind: 'generic' };
}

function isDrainUntil(value: string): boolean {
  const v = value.toLowerCase();
  return v === 'vazio' || v === 'seco' || v === 'baixo' || v === 'empty';
}

function isFillUntil(value: string): boolean {
  const v = value.toLowerCase();
  return v === 'alto' || v === 'cheio' || v === 'mojado' || v === 'high' || v === 'full';
}

function fsmActuatorFromSensorValve(step: Extract<ProcedureStep, { type: 'sensor_valve' }>) {
  const until = String(step.sensor.value ?? '').toLowerCase();
  const timeout_s = Math.max(1, Math.ceil((step.maxDurationMs > 0 ? step.maxDurationMs : 30 * 60 * 1000) / 1000));
  const act: NonNullable<ProcedureCompilePayload['rule_json']['fsm']>['drain'] = {
    relay: step.actuator.relayIndex,
    relay_number: step.actuator.relayIndex,
    until,
    timeout_s,
    target: step.actuator.target,
  };
  if (step.actuator.target === 'slave' && step.actuator.slaveMac) {
    act.slave_mac = step.actuator.slaveMac;
  }
  return act;
}

/** Bloque fsm v2 a partir dos sensor_valve (drain/fill). */
export function buildTankFsmFromSteps(
  steps: ProcedureStep[],
  procedureKind: ProcedureCompilePayload['rule_json']['procedure_kind']
): ProcedureCompilePayload['rule_json']['fsm'] | undefined {
  const sensorValves = steps.filter(
    (s): s is Extract<ProcedureStep, { type: 'sensor_valve' }> => s.type === 'sensor_valve'
  );
  if (sensorValves.length === 0) return undefined;

  let drain: ReturnType<typeof fsmActuatorFromSensorValve> | undefined;
  let fill: ReturnType<typeof fsmActuatorFromSensorValve> | undefined;
  for (const step of sensorValves) {
    const until = String(step.sensor.value ?? '').toLowerCase();
    const act = fsmActuatorFromSensorValve(step);
    if (isDrainUntil(until) && !drain) drain = act;
    else if (isFillUntil(until) && !fill) fill = act;
    else if (!drain) drain = act;
    else if (!fill) fill = act;
  }

  const hold_chemical = steps.some((s) => s.type === 'hold_chemical');

  if (procedureKind === 'drain_only' && drain) {
    return { hold_chemical, drain };
  }
  if (procedureKind === 'fill_only' && fill) {
    return { hold_chemical, fill };
  }
  if (drain && fill) {
    return { hold_chemical, drain, fill };
  }
  if (drain) return { hold_chemical, drain };
  if (fill) return { hold_chemical, fill };
  return undefined;
}

function whileConditionForSensorValve(sensor: SensorCondition): SensorCondition {
  return {
    sensor: sensor.sensor,
    operator: sensor.operator,
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
      const durationMs = step.maxDurationMs > 0 ? step.maxDurationMs : 30 * 60 * 1000;
      const maxSec = Math.max(1, Math.ceil(durationMs / 1000));
      return [
        {
          type: 'while',
          condition: whileConditionForSensorValve(step.sensor),
          max_iterations: maxSec,
          body: [
            relayInstruction(step.actuator, openState),
            { type: 'delay', delay_ms: 2000, duration_ms: 2000 },
          ],
        },
        relayInstruction(step.actuator, closeState),
      ];
    }
    case 'set_relay': {
      const instr = relayInstruction(step.actuator, step.state, step.durationSeconds);
      if (step.dosageMl != null && step.dosageMl > 0) {
        (instr as CompiledScriptInstruction & { dosage_ml?: number }).dosage_ml = step.dosageMl;
      }
      return [instr];
    }
    case 'wait':
      return [{ type: 'delay', duration_ms: step.durationMs, delay_ms: step.durationMs }];
    case 'hold_chemical':
      // Presencia del paso = bloqueo activo (sin toggle en UI)
      return [{ type: 'block_auto' }];
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

function hasValidSlaveActuator(actuator: ActuatorRef | undefined): boolean {
  return !!(
    actuator &&
    actuator.target === 'slave' &&
    typeof actuator.slaveMac === 'string' &&
    actuator.slaveMac.trim().length > 0 &&
    Number.isFinite(actuator.relayIndex) &&
    actuator.relayIndex >= 0 &&
    actuator.relayIndex <= 7
  );
}

/**
 * Tipagem P1 = só bomba de recirculação.
 * Dreno/enchimento/recarga: actuador do passo; se faltar MAC, herda slave da tipagem de circulação.
 * Nunca bloqueia sync por tipagem avançada (removida da UI).
 */
export function materializeProcedureHydraulicRoles(
  procedure: RuleProcedure,
  roles: HydraulicRolesMap
): { procedure: RuleProcedure; errors: string[] } {
  const errors: string[] = [];
  const circActuator = resolveActuator('circulation_pump', roles);

  const inferRole = (step: ProcedureStep): HydraulicRoleId | undefined => {
    if ('roleId' in step && step.roleId) return step.roleId;
    if (step.type !== 'sensor_valve') return undefined;
    const until = String(step.sensor.value ?? '').toLowerCase();
    if (until === 'vazio' || until === 'seco' || until === 'baixo' || until === 'empty') {
      return 'drain_valve';
    }
    if (until === 'alto' || until === 'cheio' || until === 'mojado' || until === 'high' || until === 'full') {
      return 'fill_valve';
    }
    return undefined;
  };

  const withInheritedSlave = <T extends ProcedureStep & { actuator: ActuatorRef; roleId?: HydraulicRoleId }>(
    step: T,
    roleId?: HydraulicRoleId
  ): T => {
    if (hasValidSlaveActuator(step.actuator)) {
      return roleId ? { ...step, roleId } : step;
    }
    if (!circActuator?.slaveMac) {
      return roleId ? { ...step, roleId } : step;
    }
    const relayIndex =
      Number.isFinite(step.actuator?.relayIndex) && step.actuator.relayIndex >= 0
        ? step.actuator.relayIndex
        : 0;
    return {
      ...step,
      ...(roleId ? { roleId } : {}),
      actuator: {
        target: 'slave',
        slaveMac: circActuator.slaveMac,
        relayIndex,
        label: step.actuator?.label ?? getHydraulicRoleDefinition(roleId ?? 'drain_valve')?.label,
      },
    };
  };

  const steps = procedure.steps.map((step) => {
    if (step.type !== 'sensor_valve' && step.type !== 'set_relay') return step;
    const roleId = inferRole(step);

    // Única tipagem P1: recirculação
    if (roleId === 'circulation_pump') {
      if (circActuator) {
        return { ...step, roleId, actuator: circActuator };
      }
      if (hasValidSlaveActuator(step.actuator)) {
        return { ...step, roleId };
      }
      errors.push('Configure a tipagem da bomba de recirculação contínua');
      return step;
    }

    // dreno / enchimento / recarga — sem tipagem avançada
    if (
      roleId === 'drain_valve' ||
      roleId === 'fill_valve' ||
      roleId === 'recharge_pump' ||
      step.type === 'sensor_valve'
    ) {
      return withInheritedSlave(step, roleId);
    }

    return step;
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

  const normalizedSteps = repairProcedureSteps(resolved.steps);
  const procedureForCompile = { ...resolved, steps: normalizedSteps };

  const instructions: CompiledScriptInstruction[] = [];
  for (const step of procedureForCompile.steps) {
    if (step.type === 'invoke_rule') continue;
    instructions.push(...compileStep(step));
  }

  const chainFromProcedure = procedure.chain ?? [];
  const chainFromSteps = compileInvokeSteps(procedureForCompile.steps);
  const chained = compileChain([...chainFromProcedure, ...chainFromSteps]);

  const script: ProcedureCompilePayload['rule_json']['script'] = {
    instructions,
    loop_interval_ms: 1000,
    max_iterations: 0,
    chained_events: chained,
  };

  const classification = classifyCompiledScript(instructions);

  const sensorValveCount = procedureForCompile.steps.filter((s) => s.type === 'sensor_valve').length;
  let procedure_kind = classification.procedure_kind;
  if (classification.execution_class === 'procedure' && sensorValveCount >= 2) {
    procedure_kind = 'full_recharge';
  }

  const fsm = buildTankFsmFromSteps(procedureForCompile.steps, procedure_kind);

  return {
    procedureId: resolved.id,
    procedureName: resolved.name,
    layer: resolved.layer,
    priority: resolved.priority,
    enabled: resolved.enabled,
    triggers: resolved.triggers,
    rule_json: {
      priority: resolved.priority,
      execution_class: classification.execution_class,
      procedure_kind,
      procedure_ref: { id: resolved.id, layer: resolved.layer },
      procedure_triggers: resolved.triggers,
      ...(fsm ? { fsm } : {}),
      script,
      procedure_steps: procedureForCompile.steps,
    },
  };
}
