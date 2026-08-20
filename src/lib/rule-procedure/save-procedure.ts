import { createDecisionRule, getDecisionRules, updateDecisionRule } from '@/lib/automation';
import type { RuleProcedure } from './types';
import { validateProcedure } from './validate-procedure';
import { compileProcedureToPayload } from './compile-procedure';

export interface SaveProcedureResult {
  ok: boolean;
  error?: string;
  ruleDbId?: string;
  created: boolean;
}

export async function saveProcedureToDecisionRules(
  deviceId: string,
  procedure: RuleProcedure,
  createdBy?: string
): Promise<SaveProcedureResult> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'Selecione um dispositivo master', created: false };
  }

  const validation = validateProcedure(procedure);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('; '), created: false };
  }

  const payload = compileProcedureToPayload(procedure);
  const ruleJson = {
    ...payload.rule_json,
    procedure_triggers: procedure.triggers,
    procedure_canonical: procedure,
  };

  const existing = await getDecisionRules(deviceId);
  const match = existing.find((r) => r.rule_id === procedure.id);

  try {
    if (match?.id) {
      const ok = await updateDecisionRule(match.id, {
        rule_name: procedure.name,
        rule_description: procedure.description,
        rule_json: ruleJson as never,
        enabled: procedure.enabled,
        priority: procedure.priority,
      });
      return ok
        ? { ok: true, ruleDbId: match.id, created: false }
        : { ok: false, error: 'Falha ao atualizar regra', created: false };
    }

    const created = await createDecisionRule({
      device_id: deviceId,
      rule_id: procedure.id,
      rule_name: procedure.name,
      rule_description: procedure.description,
      rule_json: ruleJson as never,
      enabled: procedure.enabled,
      priority: procedure.priority,
      created_by: createdBy ?? 'rule-builder',
    });

    if (!created?.id) {
      return { ok: false, error: 'Falha ao criar regra', created: false };
    }
    return { ok: true, ruleDbId: created.id, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return { ok: false, error: msg, created: false };
  }
}
