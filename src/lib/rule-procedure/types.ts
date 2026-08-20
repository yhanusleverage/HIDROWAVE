export type ProcedureLayer = 'P1' | 'P2' | 'P3' | 'P4' | 'general';

export type HydraulicRoleId =
  | 'circulation_pump'
  | 'fill_valve'
  | 'drain_valve'
  | 'recharge_pump';

export type ActuatorTarget = 'master' | 'slave';

export interface ActuatorRef {
  target: ActuatorTarget;
  relayIndex: number;
  slaveMac?: string;
  label?: string;
}

export interface SensorCondition {
  sensor: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: string | number;
}

export type ProcedureTrigger =
  | { type: 'time_window'; start: string; end: string; timezone?: string }
  | { type: 'interval'; everyMs: number }
  | { type: 'cycle_week'; weekIndex: number }
  | { type: 'manual' };

export type ProcedureStep =
  | {
      type: 'sensor_valve';
      id: string;
      label?: string;
      roleId?: HydraulicRoleId;
      actuator: ActuatorRef;
      sensor: SensorCondition;
      valveStart: 'open' | 'closed';
      valveFinish: 'open' | 'closed';
      maxDurationMs: number;
    }
  | {
      type: 'set_relay';
      id: string;
      label?: string;
      roleId?: HydraulicRoleId;
      actuator: ActuatorRef;
      state: 'on' | 'off';
      durationSeconds?: number;
    }
  | { type: 'wait'; id: string; label?: string; durationMs: number }
  | { type: 'hold_chemical'; id: string; enabled: boolean }
  | {
      type: 'invoke_rule';
      id: string;
      targetRuleId: string;
      on: 'success' | 'failure';
      delayMs?: number;
    };

export interface ProcedureChainLink {
  targetRuleId: string;
  on: 'success' | 'failure';
  delayMs: number;
}

export interface ProcedureSafety {
  id: string;
  description: string;
}

export interface RuleProcedure {
  id: string;
  name: string;
  description?: string;
  priority: number;
  layer: ProcedureLayer;
  enabled: boolean;
  triggers: ProcedureTrigger[];
  steps: ProcedureStep[];
  chain?: ProcedureChainLink[];
  safety?: ProcedureSafety[];
}

export const LAYER_PRIORITY_HINT: Record<ProcedureLayer, { min: number; max: number }> = {
  P1: { min: 85, max: 95 },
  P2: { min: 50, max: 79 },
  P3: { min: 50, max: 79 },
  P4: { min: 20, max: 40 },
  general: { min: 0, max: 100 },
};

export const STEP_TYPE_LABELS: Record<ProcedureStep['type'], string> = {
  sensor_valve: 'Válvula por sensor',
  set_relay: 'Ligar / desligar relé',
  wait: 'Aguardar',
  hold_chemical: 'Pausar Auto EC/pH',
  invoke_rule: 'Regra encadeada',
};
