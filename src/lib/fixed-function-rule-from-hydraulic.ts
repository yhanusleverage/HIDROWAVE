/**
 * Regras fn_* a partir da tipagem de funções fixas.
 * Criadas **inativas** (enabled=false) — operador ativa no Motor de Regras.
 * Ação simples (condition + relay_on), sem script sequencial de procedimento.
 *
 * rule_id canônico = slug ligado ao título (encadear reações).
 * Alias legados (fn_circulation, …) migrados no upsert.
 */

import { getSupabaseWriterForDecisionRules } from '@/lib/supabase-server';
import {
  getHydraulicRoleDefinition,
  sanitizeSlaveMac,
  type HydraulicRoleBinding,
  type HydraulicRoleId,
} from '@/lib/hydraulic-relay-roles';
import type { SupabaseClient } from '@supabase/supabase-js';

/** IDs canônicos (slug ≈ título pt-BR). */
export const FN_RULE_IDS: Record<HydraulicRoleId, string> = {
  circulation_pump: 'fn_recirculacao_continua',
  fill_valve: 'fn_enchimento_ate_alto',
  drain_valve: 'fn_dreno_ate_vazio',
  recharge_pump: 'fn_recarga_ate_alto',
};

/** IDs antigos → canônico (migração tipagem / SQL). */
export const FN_RULE_ID_ALIASES: Record<string, string> = {
  fn_circulation: 'fn_recirculacao_continua',
  fn_fill_valve: 'fn_enchimento_ate_alto',
  fn_drain_valve: 'fn_dreno_ate_vazio',
  fn_recharge_pump: 'fn_recarga_ate_alto',
};

export function canonicalFnRuleId(ruleId: string): string {
  return FN_RULE_ID_ALIASES[ruleId] ?? ruleId;
}

export function allRuleIdsForRole(roleId: HydraulicRoleId): string[] {
  const canonical = FN_RULE_IDS[roleId];
  const legacy = Object.entries(FN_RULE_ID_ALIASES)
    .filter(([, c]) => c === canonical)
    .map(([old]) => old);
  return [canonical, ...legacy.filter((id) => id !== canonical)];
}

export function roleIdFromFnRuleId(ruleId: string): HydraulicRoleId | undefined {
  const canonical = canonicalFnRuleId(ruleId);
  const entry = (Object.entries(FN_RULE_IDS) as [HydraulicRoleId, string][]).find(
    ([, id]) => id === canonical
  );
  return entry?.[0];
}

export const FN_RULE_NAME_KEYS: Record<HydraulicRoleId, string> = {
  circulation_pump: 'rules.fn_circulation',
  fill_valve: 'rules.fn_fill_valve',
  drain_valve: 'rules.fn_drain_valve',
  recharge_pump: 'rules.fn_recharge_pump',
};

/** Fallback pt-BR para rule_name em DB (Motor resolve i18n via rule_name_key). */
export const FN_RULE_NAME_PT: Record<HydraulicRoleId, string> = {
  circulation_pump: 'Recirculação contínua',
  fill_valve: 'Enchimento até alto',
  drain_valve: 'Dreno até vazio',
  recharge_pump: 'Recarga até alto',
};

export const FN_RULE_PRIORITIES: Record<HydraulicRoleId, number> = {
  circulation_pump: 30,
  fill_valve: 85,
  drain_valve: 85,
  recharge_pump: 40,
};

function relayOnAction(mac: string, relay: number) {
  return {
    type: 'relay_on',
    target_relay: relay,
    target_device_id: mac,
    duration_ms: 0,
  };
}

function waterLevelCondition(op: '!=' | '==', value: string) {
  return {
    type: 'sensor_compare',
    sensor: 'water_level',
    sensor_name: 'water_level',
    op,
    string_value: value,
    value: value === 'alto' || value === 'vazio' ? 0 : 0,
  };
}

export function buildFixedFunctionRuleJson(
  roleId: HydraulicRoleId,
  binding: { slaveMac: string; relayIndex: number }
) {
  const mac = sanitizeSlaveMac(binding.slaveMac);
  const relay = binding.relayIndex;
  const priority = FN_RULE_PRIORITIES[roleId];
  const def = getHydraulicRoleDefinition(roleId);

  const base = {
    priority,
    source: 'hydraulic_roles',
    hydraulic_role: roleId,
    i18n_key: FN_RULE_NAME_KEYS[roleId],
    interval_between_executions: 30,
    description_note: def?.fixedBehavior ?? '',
  };

  switch (roleId) {
    case 'circulation_pump':
      return {
        ...base,
        condition: {
          type: 'time_window',
          sensor_name: 'time_window',
        },
        actions: [relayOnAction(mac, relay)],
        interval_between_executions: 60,
      };

    case 'fill_valve':
      return {
        ...base,
        condition: waterLevelCondition('!=', 'alto'),
        actions: [],
        script: {
          instructions: [
            {
              type: 'while',
              sensor: 'water_level',
              op: '!=',
              value: 'alto',
              max_iterations: 0,
              body: [
                {
                  type: 'relay_action',
                  relay_number: relay,
                  action: 'on',
                  target: 'slave',
                  slave_mac: mac,
                  duration_seconds: 0,
                },
                { type: 'delay', delay_ms: 2000 },
              ],
            },
            {
              type: 'relay_action',
              relay_number: relay,
              action: 'off',
              target: 'slave',
              slave_mac: mac,
              duration_seconds: 0,
            },
          ],
          loop_interval_ms: 2000,
        },
      };

    case 'drain_valve':
      return {
        ...base,
        condition: waterLevelCondition('!=', 'vazio'),
        actions: [],
        script: {
          instructions: [
            {
              type: 'while',
              sensor: 'water_level',
              op: '!=',
              value: 'vazio',
              max_iterations: 0,
              body: [
                {
                  type: 'relay_action',
                  relay_number: relay,
                  action: 'on',
                  target: 'slave',
                  slave_mac: mac,
                  duration_seconds: 0,
                },
                { type: 'delay', delay_ms: 2000 },
              ],
            },
            {
              type: 'relay_action',
              relay_number: relay,
              action: 'off',
              target: 'slave',
              slave_mac: mac,
              duration_seconds: 0,
            },
          ],
          loop_interval_ms: 2000,
        },
      };

    case 'recharge_pump':
      return {
        ...base,
        condition: waterLevelCondition('!=', 'alto'),
        actions: [relayOnAction(mac, relay)],
      };
  }
}

function ruleMeta(roleId: HydraulicRoleId): {
  name: string;
  nameKey: string;
  description: string;
} {
  switch (roleId) {
    case 'circulation_pump':
      return {
        name: FN_RULE_NAME_PT.circulation_pump,
        nameKey: FN_RULE_NAME_KEYS.circulation_pump,
        description:
          'Bomba de circulação via tipagem. Inativa até ativar no Motor. Gate mistura Auto EC/pH = relé ON.',
      };
    case 'fill_valve':
      return {
        name: FN_RULE_NAME_PT.fill_valve,
        nameKey: FN_RULE_NAME_KEYS.fill_valve,
        description:
          'Válvula de enchimento: ON enquanto water_level ≠ alto. Criada inativa pela tipagem. P1 ao ativar.',
      };
    case 'drain_valve':
      return {
        name: FN_RULE_NAME_PT.drain_valve,
        nameKey: FN_RULE_NAME_KEYS.drain_valve,
        description:
          'Válvula de dreno: ON enquanto water_level ≠ vazio. Criada inativa pela tipagem. P1 ao ativar.',
      };
    case 'recharge_pump':
      return {
        name: FN_RULE_NAME_PT.recharge_pump,
        nameKey: FN_RULE_NAME_KEYS.recharge_pump,
        description:
          'Bomba de recarga: ON enquanto water_level ≠ alto. Criada inativa pela tipagem.',
      };
  }
}

export async function upsertFixedFunctionRule(
  deviceId: string,
  roleId: HydraulicRoleId,
  binding: HydraulicRoleBinding | null | undefined,
  options?: { authorization?: string | null; supabase?: SupabaseClient }
): Promise<
  | {
      ok: true;
      action: 'upserted' | 'disabled' | 'skipped';
      ruleId: string;
      retiredRuleIds?: string[];
    }
  | { ok: false; error: string }
> {
  const id = deviceId.trim();
  const ruleId = FN_RULE_IDS[roleId];
  const candidateIds = allRuleIdsForRole(roleId);
  if (!id) {
    return { ok: false, error: 'device_id ausente' };
  }

  let sb = options?.supabase;
  if (!sb) {
    const writer = getSupabaseWriterForDecisionRules(options?.authorization);
    if (!writer) {
      return {
        ok: false,
        error:
          'Sem permissão para decision_rules: defina SUPABASE_SERVICE_ROLE_KEY no .env.local ou envie Authorization Bearer (sessão logada).',
      };
    }
    sb = writer.client;
  }

  const { data: existingRows, error: findErr } = await sb
    .from('decision_rules')
    .select('id, enabled, rule_id')
    .eq('device_id', id)
    .in('rule_id', candidateIds);

  if (findErr) {
    return { ok: false, error: findErr.message };
  }

  const rows = existingRows ?? [];
  const existing =
    rows.find((r) => r.rule_id === ruleId) ??
    rows.find((r) => candidateIds.includes(String(r.rule_id))) ??
    null;
  const retiredRuleIds = rows
    .map((r) => String(r.rule_id))
    .filter((rid) => rid !== ruleId);

  const hasBinding =
    !!binding?.slaveMac?.trim() &&
    binding.relayIndex >= 0 &&
    binding.relayIndex <= 7;

  if (!hasBinding) {
    if (existing?.id) {
      const { error } = await sb
        .from('decision_rules')
        .update({
          enabled: false,
          rule_id: ruleId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
      for (const legacy of rows) {
        if (legacy.id === existing.id) continue;
        await sb
          .from('decision_rules')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('id', legacy.id);
      }
      return { ok: true, action: 'disabled', ruleId, retiredRuleIds };
    }
    return { ok: true, action: 'skipped', ruleId };
  }

  const ruleJson = buildFixedFunctionRuleJson(roleId, {
    slaveMac: binding!.slaveMac,
    relayIndex: binding!.relayIndex,
  });
  const meta = ruleMeta(roleId);
  const priority = FN_RULE_PRIORITIES[roleId];
  const enabled = existing?.id ? Boolean(existing.enabled) : false;

  const cleanRuleJson: Record<string, unknown> = {
    ...ruleJson,
    i18n_key: meta.nameKey,
  };
  if (
    Array.isArray(cleanRuleJson.conditions) &&
    (cleanRuleJson.conditions as unknown[]).length === 0
  ) {
    delete cleanRuleJson.conditions;
  }

  const row = {
    device_id: id,
    rule_id: ruleId,
    rule_name: meta.name,
    rule_description: meta.description,
    rule_json: cleanRuleJson,
    enabled,
    priority,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await sb.from('decision_rules').update(row).eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
    for (const legacy of rows) {
      if (legacy.id === existing.id) continue;
      await sb.from('decision_rules').delete().eq('id', legacy.id);
    }
  } else {
    const { error } = await sb.from('decision_rules').insert({
      ...row,
      created_by: 'hydraulic_roles',
    });
    if (error) return { ok: false, error: error.message };
    for (const legacy of rows) {
      await sb.from('decision_rules').delete().eq('id', legacy.id);
    }
  }

  return { ok: true, action: 'upserted', ruleId, retiredRuleIds };
}

/** @deprecated use upsertFixedFunctionRule('circulation_pump', …) */
export const FN_CIRCULATION_RULE_ID = FN_RULE_IDS.circulation_pump;
export const FN_CIRCULATION_PRIORITY = FN_RULE_PRIORITIES.circulation_pump;

export function buildCirculationRuleJson(binding: {
  slaveMac: string;
  relayIndex: number;
}) {
  return buildFixedFunctionRuleJson('circulation_pump', binding);
}

export async function upsertCirculationRuleFromHydraulicRoles(
  deviceId: string,
  roles: { circulation_pump?: HydraulicRoleBinding }
) {
  return upsertFixedFunctionRule(deviceId, 'circulation_pump', roles.circulation_pump);
}
