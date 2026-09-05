import { getDecisionRules, updateDecisionRule } from '@/lib/automation';

/**
 * Aplica duração (segundos) nas ações da regra — schedule guarda o "quando",
 * a regra guarda o "quanto tempo" (sem migration).
 */
export async function applyDurationSecondsToRule(
  deviceId: string,
  ruleId: string,
  durationSeconds: number
): Promise<{ ok: boolean; error?: string }> {
  if (!deviceId.trim() || !ruleId.trim()) {
    return { ok: false, error: 'device_id / rule_id ausentes' };
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return { ok: false, error: 'duração inválida' };
  }

  const rules = await getDecisionRules(deviceId);
  const rule = rules.find((r) => r.rule_id === ruleId);
  if (!rule?.id) {
    return { ok: false, error: `Regra ${ruleId} não encontrada` };
  }

  const json =
    rule.rule_json && typeof rule.rule_json === 'object'
      ? { ...(rule.rule_json as Record<string, unknown>) }
      : {};

  const actions = Array.isArray(json.actions) ? [...(json.actions as unknown[])] : [];
  if (actions.length > 0) {
    json.actions = actions.map((raw) => {
      const a = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
      a.duration = durationSeconds;
      if ('duration_ms' in a) a.duration_ms = durationSeconds * 1000;
      return a;
    });
  }

  const canonical = json.procedure_canonical;
  if (canonical && typeof canonical === 'object') {
    const proc = { ...(canonical as Record<string, unknown>) };
    const steps = Array.isArray(proc.steps) ? [...(proc.steps as unknown[])] : [];
    proc.steps = steps.map((raw) => {
      const s = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
      if (s.type === 'set_relay' || s.type === 'relay_on' || s.type === 'RELAY_ON') {
        s.durationSeconds = durationSeconds;
      }
      return s;
    });
    json.procedure_canonical = proc;
  }

  const ok = await updateDecisionRule(rule.id, {
    rule_json: json as typeof rule.rule_json,
  });
  if (!ok) return { ok: false, error: 'Falha ao atualizar duração na regra' };
  return { ok: true };
}
