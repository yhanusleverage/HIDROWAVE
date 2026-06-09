/**
 * Ejecuta reglas — INSERT em relay_commands (prod, 1 fila por relé).
 */

import { Instruction } from '@/components/SequentialScriptEditor';
import { createRelayCommandProd } from './automation';

export interface GroupedRelayAction {
  slave_mac: string;
  slave_device_id?: string;
  relay_numbers: number[];
  actions: ('on' | 'off')[];
  duration_seconds: number[];
}

export interface RuleExecutionContext {
  device_id: string;
  user_email: string;
  master_mac_address: string;
  rule_id: string;
  rule_name: string;
  priority: number;
}

export function groupRelayActionsBySlave(
  instructions: Instruction[]
): Map<string, GroupedRelayAction> {
  const grouped = new Map<string, GroupedRelayAction>();

  for (const instr of instructions) {
    if (instr.type !== 'relay_action' || instr.target !== 'slave' || !instr.slave_mac) {
      continue;
    }

    const slaveMac = instr.slave_mac;
    const relayNum = instr.relay_number ?? 0;
    const action = instr.action === 'on' || instr.action === 'off' ? instr.action : 'on';
    const duration = instr.duration_seconds ?? 0;

    if (!grouped.has(slaveMac)) {
      grouped.set(slaveMac, {
        slave_mac: slaveMac,
        relay_numbers: [],
        actions: [],
        duration_seconds: [],
      });
    }

    const group = grouped.get(slaveMac)!;
    const existingIndex = group.relay_numbers.indexOf(relayNum);
    if (existingIndex >= 0) {
      group.actions[existingIndex] = action;
      group.duration_seconds[existingIndex] = duration;
    } else {
      group.relay_numbers.push(relayNum);
      group.actions.push(action);
      group.duration_seconds.push(duration);
    }
  }

  return grouped;
}

export function extractAllRelayActions(instructions: Instruction[]): Instruction[] {
  const relayActions: Instruction[] = [];

  function traverse(instr: Instruction) {
    if (instr.type === 'relay_action') {
      relayActions.push(instr);
    }
    if (instr.body) instr.body.forEach(traverse);
    if (instr.then) instr.then.forEach(traverse);
    if (instr.else) instr.else.forEach(traverse);
  }

  instructions.forEach(traverse);
  return relayActions;
}

export async function executeDecisionRule(
  ruleJson: { script: { instructions: Instruction[] } },
  context: RuleExecutionContext
): Promise<{ success: boolean; commandsCreated: number; error?: string }> {
  try {
    const allInstructions = ruleJson.script?.instructions || [];
    const relayActions = extractAllRelayActions(allInstructions);

    if (relayActions.length === 0) {
      return { success: true, commandsCreated: 0 };
    }

    const grouped = groupRelayActionsBySlave(relayActions);
    if (grouped.size === 0) {
      return { success: true, commandsCreated: 0 };
    }

    let commandsCreated = 0;
    const errors: string[] = [];

    for (const [slaveMac, group] of grouped.entries()) {
      for (let i = 0; i < group.relay_numbers.length; i++) {
        try {
          const cmd = await createRelayCommandProd({
            device_id: context.device_id,
            relay_number: group.relay_numbers[i],
            action: group.actions[i],
            duration_seconds: group.duration_seconds[i],
            target_device_id: slaveMac,
            created_by: 'decision_rules',
          });

          if (cmd) {
            commandsCreated++;
          } else {
            errors.push(`Erro ao criar comando relé ${group.relay_numbers[i]} slave ${slaveMac}`);
          }
        } catch (error: unknown) {
          errors.push(
            `Erro relé ${group.relay_numbers[i]}: ${error instanceof Error ? error.message : 'desconhecido'}`
          );
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, commandsCreated, error: errors.join('; ') };
    }

    return { success: true, commandsCreated };
  } catch (error: unknown) {
    return {
      success: false,
      commandsCreated: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
