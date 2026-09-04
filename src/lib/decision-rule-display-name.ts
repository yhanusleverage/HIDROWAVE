/**
 * Display name for decision_rules — i18n via rule_json.i18n_key or known fn_* ids.
 */
import {
  FN_RULE_IDS,
  FN_RULE_NAME_KEYS,
  canonicalFnRuleId,
  roleIdFromFnRuleId,
  type HydraulicRoleId,
} from '@/lib/fixed-function-rule-from-hydraulic';
import type { AppTranslations } from '@/lib/translations/app/types';

const RULE_ID_TO_ROLE = Object.fromEntries(
  (Object.entries(FN_RULE_IDS) as [HydraulicRoleId, string][]).map(([role, id]) => [
    id,
    role,
  ])
) as Record<string, HydraulicRoleId>;

export function isFixedFunctionMacroRule(rule: {
  rule_id?: string | null;
  rule_json?: unknown;
}): boolean {
  if (rule.rule_id && roleIdFromFnRuleId(rule.rule_id)) return true;
  if (rule.rule_id && RULE_ID_TO_ROLE[canonicalFnRuleId(rule.rule_id)]) return true;
  const json =
    rule.rule_json && typeof rule.rule_json === 'object'
      ? (rule.rule_json as Record<string, unknown>)
      : {};
  return json.source === 'hydraulic_roles' || typeof json.hydraulic_role === 'string';
}

/** Cards Ativas/Inativas: script sequencial OU macro tipada. */
export function isMotorScriptStyleRule(rule: {
  rule_id?: string | null;
  rule_json?: unknown;
}): boolean {
  if (isFixedFunctionMacroRule(rule)) return true;
  const json =
    rule.rule_json && typeof rule.rule_json === 'object'
      ? (rule.rule_json as Record<string, unknown>)
      : {};
  const script = json.script as { instructions?: unknown[] } | undefined;
  return Array.isArray(script?.instructions) && script.instructions.length > 0;
}

export function resolveDecisionRuleDisplayName(
  rule: {
    rule_id?: string | null;
    rule_name?: string | null;
    rule_json?: unknown;
  },
  t: AppTranslations
): string {
  const json =
    rule.rule_json && typeof rule.rule_json === 'object'
      ? (rule.rule_json as Record<string, unknown>)
      : {};
  const keyFromJson =
    typeof json.i18n_key === 'string' ? json.i18n_key : null;

  const role =
    (rule.rule_id ? roleIdFromFnRuleId(rule.rule_id) : undefined) ??
    (rule.rule_id ? RULE_ID_TO_ROLE[canonicalFnRuleId(rule.rule_id)] : undefined);
  const key = keyFromJson ?? (role ? FN_RULE_NAME_KEYS[role] : null);

  const catalog = t.automacao.fixedRules;
  if (key === 'rules.fn_circulation') return catalog.fnCirculation;
  if (key === 'rules.fn_fill_valve') return catalog.fnFill;
  if (key === 'rules.fn_drain_valve') return catalog.fnDrain;
  if (key === 'rules.fn_recharge_pump') return catalog.fnRecharge;

  return (rule.rule_name ?? rule.rule_id ?? '—').toString();
}
