/**
 * Repara passos sensor_valve:
 * - timeout 0 → 30 min
 * - ON/OFF invertido (closed→open) → open→closed
 * - Migración v1→v2: semántica “até chegar” → “enquanto” (invierte ==/!= una vez)
 *
 * v2 (conditionSemantics: 'while'):
 *   == → enquanto for este nível
 *   != → enquanto não for este nível
 */

import type { ProcedureStep, SensorCondition } from './types';

function invertLevelOperator(op: SensorCondition['operator']): SensorCondition['operator'] {
  if (op === '==') return '!=';
  if (op === '!=') return '==';
  return op;
}

export function repairSensorValveStep(step: ProcedureStep): ProcedureStep {
  if (step.type !== 'sensor_valve') return step;

  let maxDurationMs = step.maxDurationMs > 0 ? step.maxDurationMs : 30 * 60 * 1000;
  let valveStart = step.valveStart;
  let valveFinish = step.valveFinish;

  if (valveStart === 'closed' && valveFinish === 'open') {
    valveStart = 'open';
    valveFinish = 'closed';
  }

  let sensor = { ...step.sensor };
  if (
    sensor.sensor === 'water_level' &&
    sensor.operator !== '==' &&
    sensor.operator !== '!='
  ) {
    sensor.operator = '!=';
  }

  let conditionSemantics = step.conditionSemantics;
  if (conditionSemantics !== 'while') {
    // Datos goal-oriented antiguos: el compilador invertía; ahora no → migrar operador.
    if (sensor.sensor === 'water_level') {
      sensor = { ...sensor, operator: invertLevelOperator(sensor.operator) };
    }
    conditionSemantics = 'while';
  }

  return {
    ...step,
    maxDurationMs,
    valveStart,
    valveFinish,
    sensor,
    conditionSemantics,
  };
}

export function repairProcedureSteps(steps: ProcedureStep[]): ProcedureStep[] {
  return steps.map(repairSensorValveStep);
}
