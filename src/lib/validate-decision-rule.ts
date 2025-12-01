import { DecisionRule } from './automation';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida una regra de decisão (decision rule) antes de salvar
 * 
 * @param rule - A regra a ser validada
 * @returns Resultado da validação com lista de erros (se houver)
 */
export function validateDecisionRule(rule: Partial<DecisionRule>): ValidationResult {
  const errors: string[] = [];

  // Validar campos obrigatórios
  if (!rule.device_id || rule.device_id.trim() === '') {
    errors.push('device_id é obrigatório');
  }

  if (!rule.rule_id || rule.rule_id.length < 3) {
    errors.push('rule_id é obrigatório e deve ter pelo menos 3 caracteres');
  }

  if (!rule.rule_name || rule.rule_name.trim() === '') {
    errors.push('rule_name é obrigatório');
  }

  // Validar rule_json
  if (!rule.rule_json) {
    errors.push('rule_json é obrigatório');
  } else {
    const ruleJson = rule.rule_json as any; // Usar any para permitir campos adicionais como 'script'

    // Verificar se tem script (formato sequencial) ou conditions/actions (formato tradicional)
    const hasScript = ruleJson.script !== undefined;
    const hasConditions = ruleJson.conditions !== undefined;
    const hasActions = ruleJson.actions !== undefined;

    // Deve ter pelo menos script OU (conditions E actions)
    if (!hasScript && (!hasConditions || !hasActions)) {
      errors.push('rule_json deve ter script OU (conditions E actions)');
    }

    // Validar conditions (se não houver script)
    if (!hasScript && hasConditions) {
      if (!Array.isArray(ruleJson.conditions)) {
        errors.push('rule_json.conditions deve ser um array');
      } else if (ruleJson.conditions.length === 0) {
        errors.push('rule_json.conditions não pode estar vazio');
      } else {
        ruleJson.conditions.forEach((condition: any, index: number) => {
          if (!condition.sensor || condition.sensor.trim() === '') {
            errors.push(`condition[${index}].sensor é obrigatório`);
          }
          if (!condition.operator || condition.operator.trim() === '') {
            errors.push(`condition[${index}].operator é obrigatório`);
          }
          if (condition.value === undefined || condition.value === null) {
            errors.push(`condition[${index}].value é obrigatório`);
          }
        });
      }
    }

    // Validar actions (se não houver script)
    if (!hasScript && hasActions) {
      if (!Array.isArray(ruleJson.actions)) {
        errors.push('rule_json.actions deve ser um array');
      } else if (ruleJson.actions.length === 0) {
        errors.push('rule_json.actions não pode estar vazio');
      } else {
        ruleJson.actions.forEach((action: any, index: number) => {
          if (!action.relay_ids || !Array.isArray(action.relay_ids) || action.relay_ids.length === 0) {
            errors.push(`action[${index}].relay_ids deve ser um array não vazio`);
          }
          if (!action.relay_names || !Array.isArray(action.relay_names) || action.relay_names.length === 0) {
            errors.push(`action[${index}].relay_names deve ser um array não vazio`);
          }
          if (action.relay_ids.length !== action.relay_names.length) {
            errors.push(`action[${index}].relay_ids e relay_names devem ter o mesmo tamanho`);
          }
          if (typeof action.duration !== 'number' || action.duration < 0) {
            errors.push(`action[${index}].duration deve ser um número não negativo`);
          }
        });
      }
    }

    // Validar circadian_cycle se presente
    if (ruleJson.circadian_cycle) {
      const cycle = ruleJson.circadian_cycle;
      
      if (typeof cycle.on_duration_ms !== 'number' || cycle.on_duration_ms < 0) {
        errors.push('circadian_cycle.on_duration_ms deve ser um número não negativo');
      }
      
      if (typeof cycle.off_duration_ms !== 'number' || cycle.off_duration_ms < 0) {
        errors.push('circadian_cycle.off_duration_ms deve ser um número não negativo');
      }
      
      if (typeof cycle.total_cycle_ms !== 'number') {
        errors.push('circadian_cycle.total_cycle_ms deve ser um número');
      } else if (cycle.total_cycle_ms !== 86400000) {
        // 24 horas = 86400000ms
        errors.push('circadian_cycle.total_cycle_ms deve ser 86400000 (24 horas)');
      }
      
      if (cycle.on_duration_ms + cycle.off_duration_ms !== cycle.total_cycle_ms) {
        errors.push('circadian_cycle: on_duration_ms + off_duration_ms deve ser igual a total_cycle_ms');
      }
    }

    // Validar priority se presente
    if (ruleJson.priority !== undefined) {
      if (typeof ruleJson.priority !== 'number' || ruleJson.priority < 0 || ruleJson.priority > 100) {
        errors.push('rule_json.priority deve estar entre 0 e 100');
      }
    }
  }

  // Validar priority no nível superior
  if (rule.priority !== undefined) {
    if (typeof rule.priority !== 'number' || rule.priority < 0 || rule.priority > 100) {
      errors.push('priority deve estar entre 0 e 100');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

