/**
 * 🎯 DECISION RULES EXECUTOR
 * 
 * Este módulo agrupa múltiples relay_action del mismo slave
 * en un único comando con arrays, siguiendo el patrón de EXEMPLO_COMANDO_MULTIPLOS_RELES.md
 */

import { Instruction } from '@/components/SequentialScriptEditor';
import { createSlaveCommandDirect } from './automation';

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

/**
 * Agrupa instrucciones relay_action por slave_mac
 * Crea arrays de relay_numbers, actions y duration_seconds
 */
export function groupRelayActionsBySlave(
  instructions: Instruction[]
): Map<string, GroupedRelayAction> {
  const grouped = new Map<string, GroupedRelayAction>();

  for (const instr of instructions) {
    // Solo procesar relay_action que apuntan a slaves
    if (instr.type !== 'relay_action' || instr.target !== 'slave' || !instr.slave_mac) {
      continue;
    }

    const slaveMac = instr.slave_mac;
    const relayNum = instr.relay_number ?? 0;
    const action = (instr.action === 'on' || instr.action === 'off') 
      ? instr.action 
      : 'on';
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
    
    // Evitar duplicados (mismo relay_number)
    const existingIndex = group.relay_numbers.indexOf(relayNum);
    if (existingIndex >= 0) {
      // Actualizar acción y duración si ya existe
      group.actions[existingIndex] = action;
      group.duration_seconds[existingIndex] = duration;
    } else {
      // Agregar nuevo relé
      group.relay_numbers.push(relayNum);
      group.actions.push(action);
      group.duration_seconds.push(duration);
    }
  }

  return grouped;
}

/**
 * Extrae todas las instrucciones relay_action de un árbol de instrucciones
 * (incluye instrucciones dentro de while, if, etc.)
 */
export function extractAllRelayActions(instructions: Instruction[]): Instruction[] {
  const relayActions: Instruction[] = [];

  function traverse(instr: Instruction) {
    if (instr.type === 'relay_action') {
      relayActions.push(instr);
    }

    // Recursivamente procesar body, then, else
    if (instr.body) {
      instr.body.forEach(traverse);
    }
    if (instr.then) {
      instr.then.forEach(traverse);
    }
    if (instr.else) {
      instr.else.forEach(traverse);
    }
  }

  instructions.forEach(traverse);
  return relayActions;
}

/**
 * Ejecuta una regra de decisión, agrupando múltiples relay_action
 * del mismo slave en un único comando con arrays
 */
export async function executeDecisionRule(
  ruleJson: {
    script: {
      instructions: Instruction[];
    };
  },
  context: RuleExecutionContext
): Promise<{ success: boolean; commandsCreated: number; error?: string }> {
  try {
    // 1. Extraer todas las instrucciones relay_action
    const allInstructions = ruleJson.script?.instructions || [];
    const relayActions = extractAllRelayActions(allInstructions);

    if (relayActions.length === 0) {
      return { success: true, commandsCreated: 0 };
    }

    // 2. Agrupar por slave_mac
    const grouped = groupRelayActionsBySlave(relayActions);

    if (grouped.size === 0) {
      return { success: true, commandsCreated: 0 };
    }

    // 3. Crear un comando por cada slave (con arrays)
    let commandsCreated = 0;
    const errors: string[] = [];

    for (const [slaveMac, group] of grouped.entries()) {
      try {
        // Determinar slave_device_id (si no está disponible, generar uno)
        const slaveDeviceId = group.slave_device_id || `ESP32_SLAVE_${slaveMac.replace(/:/g, '_')}`;

        const result = await createSlaveCommandDirect({
          master_device_id: context.device_id,
          user_email: context.user_email,
          master_mac_address: context.master_mac_address,
          slave_device_id: slaveDeviceId,
          slave_mac_address: slaveMac,
          relay_numbers: group.relay_numbers,
          actions: group.actions,
          duration_seconds: group.duration_seconds,
          command_type: 'rule',
          priority: context.priority,
          triggered_by: 'rule',
          rule_id: context.rule_id,
          rule_name: context.rule_name,
        });

        if (result?.success) {
          commandsCreated++;
          console.log(`✅ [DECISION RULE] Comando criado para slave ${slaveMac}:`, {
            relay_numbers: group.relay_numbers,
            actions: group.actions,
            duration_seconds: group.duration_seconds,
          });
        } else {
          errors.push(`Erro ao criar comando para slave ${slaveMac}: ${result?.error || 'Erro desconhecido'}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push(`Erro ao criar comando para slave ${slaveMac}: ${errorMessage}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        commandsCreated,
        error: errors.join('; '),
      };
    }

    return { success: true, commandsCreated };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ [DECISION RULE] Erro ao executar regra:', error);
    return {
      success: false,
      commandsCreated: 0,
      error: errorMessage,
    };
  }
}

/**
 * Ejemplo de uso:
 * 
 * const ruleJson = {
 *   script: {
 *     instructions: [
 *       {
 *         type: 'while',
 *         condition: { sensor: 'ph', operator: '<', value: 6.5 },
 *         body: [
 *           { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 0, action: 'on' },
 *           { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 1, action: 'on' },
 *           { type: 'relay_action', target: 'slave', slave_mac: '14:33:5C:38:BF:60', relay_number: 2, action: 'on' },
 *         ]
 *       }
 *     ]
 *   }
 * };
 * 
 * const context = {
 *   device_id: 'ESP32_HIDRO_F44738',
 *   user_email: 'user@email.com',
 *   master_mac_address: 'AA:BB:CC:DD:EE:FF',
 *   rule_id: 'RULE_001',
 *   rule_name: 'Ajustar pH quando baixo',
 *   priority: 50,
 * };
 * 
 * const result = await executeDecisionRule(ruleJson, context);
 * // Cria 1 comando com: relay_numbers: [0, 1, 2], actions: ['on', 'on', 'on']
 */
