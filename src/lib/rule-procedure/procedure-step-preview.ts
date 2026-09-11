/**
 * Resumo humano de procedure_steps para tarjetas do Motor (evita LOOP engañoso).
 */

import type { ProcedureStep } from '@/lib/rule-procedure/types';
import {
  formatConditionPhrase,
  type InstrLabels,
} from '@/lib/instruction-labels';
import { repairSensorValveStep } from '@/lib/rule-procedure/repair-sensor-valve';

type ProcedureCopy = {
  stepSensorValve: string;
  stepSetRelay: string;
  stepWait: string;
  stepHoldChemical: string;
  valveOpen: string;
  valveClosed: string;
};

function duringLabel(step: Extract<ProcedureStep, { type: 'sensor_valve' }>): string {
  return step.valveStart === 'open' ? 'ON' : 'OFF';
}

function afterLabel(step: Extract<ProcedureStep, { type: 'sensor_valve' }>): string {
  return step.valveFinish === 'open' ? 'ON' : 'OFF';
}

export function formatProcedureStepPreview(
  step: ProcedureStep,
  instr: InstrLabels,
  p: ProcedureCopy
): string {
  const normalized = repairSensorValveStep(step);
  switch (normalized.type) {
    case 'sensor_valve': {
      const name = normalized.label?.trim() || p.stepSensorValve;
      const levelPhrase = formatConditionPhrase(
        {
          sensor: normalized.sensor.sensor,
          operator: '==',
          value: normalized.sensor.value,
        },
        instr
      );
      const mode =
        normalized.sensor.operator === '==' ? 'enquanto for' : 'enquanto não for';
      const relay = normalized.actuator.relayIndex;
      return `${name}: ${mode} ${levelPhrase || 'nível'} · R${relay} ${duringLabel(normalized)} → ${afterLabel(normalized)}`;
    }
    case 'set_relay': {
      const name = normalized.label?.trim() || p.stepSetRelay;
      const state = normalized.state === 'on' ? 'ON' : 'OFF';
      const dur =
        normalized.durationSeconds != null && normalized.durationSeconds > 0
          ? ` ${normalized.durationSeconds}s`
          : '';
      return `${name}: R${normalized.actuator.relayIndex} ${state}${dur}`;
    }
    case 'wait': {
      const sec = Math.max(1, Math.round(normalized.durationMs / 1000));
      return `${p.stepWait}: ${sec}s`;
    }
    case 'hold_chemical':
      return p.stepHoldChemical;
    case 'invoke_rule':
      return `${normalized.targetRuleId} (${normalized.on})`;
    default:
      return '—';
  }
}

export function formatProcedureStepsPreviewList(
  steps: ProcedureStep[],
  instr: InstrLabels,
  p: ProcedureCopy,
  limit = 3
): string[] {
  return steps.slice(0, limit).map((s) => formatProcedureStepPreview(s, instr, p));
}
