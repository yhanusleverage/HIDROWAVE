import type { Instruction } from '@/components/SequentialScriptEditor';
import { normalizeCondition } from '@/lib/instruction-labels';

export function newInstructionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `instr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createNestedInstruction(type: Instruction['type']): Instruction {
  return {
    id: newInstructionId(),
    type,
    relay_number: type === 'relay_action' ? 0 : undefined,
    action: type === 'relay_action' ? 'on' : undefined,
    duration_ms: type === 'switch' ? 1000 : undefined,
    condition:
      type === 'while' || type === 'if'
        ? { sensor: 'water_level', operator: '!=', value: 'vazio' }
        : undefined,
    body: type === 'while' ? [] : undefined,
    then: type === 'if' ? [] : undefined,
    else: type === 'if' ? [] : undefined,
  };
}

/** Novo procedimento: já começa com Bloquear Auto (pausa EC/pH). */
export function defaultProcedureInstructions(): Instruction[] {
  return [createNestedInstruction('block_auto')];
}

function normalizeInstructionTree(instr: Instruction): Instruction {
  const normalized: Instruction = {
    ...instr,
    condition:
      instr.condition != null
        ? (() => {
            const norm = normalizeCondition(instr.condition);
            return {
              sensor: norm.sensor,
              operator: norm.operator,
              value: String(norm.value),
            };
          })()
        : instr.condition,
    body: instr.body?.map(normalizeInstructionTree),
    then: instr.then?.map(normalizeInstructionTree),
    else: instr.else?.map(normalizeInstructionTree),
  };
  return normalized;
}

export function ensureInstructionIds(instructions: Instruction[]): Instruction[] {
  return instructions.map((instr) => {
    const normalized = normalizeInstructionTree(instr);
    return {
      ...normalized,
      id: normalized.id || newInstructionId(),
    };
  });
}
