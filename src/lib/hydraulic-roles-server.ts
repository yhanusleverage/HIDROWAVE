import {
  getSupabaseServerClient,
  getSupabaseWriterForDecisionRules,
} from '@/lib/supabase-server';
import {
  HYDRAULIC_ROLE_DEFINITIONS,
  normalizeHydraulicRolesJson,
  validateHydraulicRolesMap,
  bindingKey,
  getHydraulicRoleDefinition,
  sanitizeSlaveMac,
  type HydraulicRoleBinding,
  type HydraulicRoleId,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import { saveSlaveRelayName } from '@/lib/esp-now-slaves';
import { upsertFixedFunctionRule, FN_RULE_IDS } from '@/lib/fixed-function-rule-from-hydraulic';
import { notifyDeviceCircConfig } from '@/lib/mqtt-circ-publish';
import {
  notifyDeviceRuleUpsert,
  notifyDeviceRulesManifest,
  hashRulePayload,
} from '@/lib/mqtt-rules-publish';
import type { SupabaseClient } from '@supabase/supabase-js';

export type HydraulicRolesSaveOptions = {
  /** Authorization Bearer JWT — necessário se não houver SUPABASE_SERVICE_ROLE_KEY */
  authorization?: string | null;
};

function decisionRulesClient(authorization?: string | null): SupabaseClient | null {
  return getSupabaseWriterForDecisionRules(authorization)?.client ?? null;
}

export async function getHydraulicRolesForDevice(
  deviceId: string
): Promise<{ ok: true; roles: HydraulicRolesMap } | { ok: false; error: string }> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente' };
  }

  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from('relay_master')
    .select('hydraulic_roles_json')
    .eq('device_id', deviceId.trim())
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    roles: normalizeHydraulicRolesJson(data?.hydraulic_roles_json),
  };
}

function validateSingleRoleConflict(
  roles: HydraulicRolesMap,
  roleId: HydraulicRoleId,
  binding: HydraulicRoleBinding | undefined
): string[] {
  const errors: string[] = [];
  if (!binding?.slaveMac?.trim()) {
    return errors;
  }
  if (binding.relayIndex < 0 || binding.relayIndex > 7) {
    errors.push(`${roleId}: relayIndex deve ser 0-7`);
    return errors;
  }
  const key = bindingKey(binding);
  for (const [otherId, other] of Object.entries(roles) as [
    HydraulicRoleId,
    HydraulicRoleBinding | undefined,
  ][]) {
    if (otherId === roleId || !other?.slaveMac) continue;
    if (bindingKey(other) === key) {
      errors.push(
        `Relé ${binding.slaveMac} R${binding.relayIndex} já atribuído a ${otherId}`
      );
    }
  }
  return errors;
}

async function persistRolesMap(
  deviceId: string,
  roles: HydraulicRolesMap
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseServerClient();

  const { data: existing, error: fetchErr } = await sb
    .from('relay_master')
    .select('device_id, user_email')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const payload = {
    device_id: deviceId,
    hydraulic_roles_json: roles,
    updated_at: new Date().toISOString(),
  };

  if (existing?.device_id) {
    const { error } = await sb
      .from('relay_master')
      .update(payload)
      .eq('device_id', deviceId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb.from('relay_master').insert({
      ...payload,
      user_email: 'system@hydrowave.local',
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function renameRoleRelay(
  deviceId: string,
  roleId: HydraulicRoleId,
  binding: HydraulicRoleBinding
): Promise<void> {
  const def = getHydraulicRoleDefinition(roleId);
  const renameResult = await saveSlaveRelayName(
    deviceId,
    binding.slaveMac,
    '',
    binding.relayIndex,
    def?.label ?? roleId
  );
  if (!renameResult.ok) {
    console.warn(`[hydraulic-roles] rename ${roleId}:`, renameResult.error);
  }
}

async function publishRulesManifestForDevice(
  deviceId: string,
  sb: SupabaseClient
): Promise<void> {
  const { data, error } = await sb
    .from('decision_rules')
    .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
    .eq('device_id', deviceId);
  if (error || !data) {
    console.warn('[hydraulic-roles] manifest fetch:', error?.message);
    return;
  }
  const entries = data.map((row) => {
    const body = {
      rule_id: row.rule_id,
      rule_name: row.rule_name,
      rule_description: row.rule_description,
      enabled: Boolean(row.enabled),
      priority: row.priority ?? 50,
      rule_json: row.rule_json ?? {},
    };
    return {
      rule_id: String(row.rule_id),
      hash: hashRulePayload(body as Record<string, unknown>),
      enabled: Boolean(row.enabled),
    };
  });
  await notifyDeviceRulesManifest(deviceId, entries);
}

async function publishFnRuleMqtt(
  deviceId: string,
  ruleId: string,
  action: string,
  sb: SupabaseClient,
  retiredRuleIds: string[] = []
): Promise<void> {
  // Retirar aliases legados do Core (SPIFFS) após rename de rule_id
  for (const oldId of retiredRuleIds) {
    await notifyDeviceRuleUpsert(deviceId, { rule_id: oldId, enabled: false }, 'delete');
  }

  const { data } = await sb
    .from('decision_rules')
    .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
    .eq('device_id', deviceId)
    .eq('rule_id', ruleId)
    .maybeSingle();
  if (!data) {
    // Sem fila: desactivar no Core sem borrar topic retained vacío — disable soft
    await notifyDeviceRuleUpsert(
      deviceId,
      { rule_id: ruleId, enabled: false },
      'disable'
    );
    await publishRulesManifestForDevice(deviceId, sb);
    return;
  }
  // Sempre upsert (enabled true/false). Nunca "disable"=remove: a macro inactiva
  // tem de ficar no Core para ativar no Motor sem re-tipar.
  void action;
  await notifyDeviceRuleUpsert(
    deviceId,
    {
      rule_id: data.rule_id,
      rule_name: data.rule_name ?? undefined,
      rule_description: data.rule_description ?? undefined,
      rule_json: data.rule_json,
      enabled: Boolean(data.enabled),
      priority: data.priority ?? undefined,
    },
    'upsert'
  );
  await publishRulesManifestForDevice(deviceId, sb);
}

/**
 * Tipagem de uma função fixa: grava binding + cria/atualiza regra fn_* inativa.
 */
export async function saveHydraulicRoleForDevice(
  deviceId: string,
  roleId: HydraulicRoleId,
  binding: HydraulicRoleBinding | null,
  options?: HydraulicRolesSaveOptions
): Promise<
  | { ok: true; roles: HydraulicRolesMap; ruleId: string; ruleAction: string }
  | { ok: false; error: string }
> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente' };
  }
  if (!HYDRAULIC_ROLE_DEFINITIONS.some((d) => d.id === roleId)) {
    return { ok: false, error: `role_id inválido: ${roleId}` };
  }

  const loaded = await getHydraulicRolesForDevice(deviceId.trim());
  if (!loaded.ok) return loaded;

  const next: HydraulicRolesMap = { ...loaded.roles };
  if (binding?.slaveMac?.trim()) {
    next[roleId] = {
      target: 'slave',
      slaveMac: sanitizeSlaveMac(binding.slaveMac),
      relayIndex: binding.relayIndex,
    };
  } else {
    delete next[roleId];
  }

  const conflicts = validateSingleRoleConflict(next, roleId, next[roleId]);
  if (conflicts.length > 0) {
    return { ok: false, error: conflicts.join('; ') };
  }

  const persisted = await persistRolesMap(deviceId.trim(), next);
  if (!persisted.ok) return persisted;

  if (next[roleId]) {
    await renameRoleRelay(deviceId.trim(), roleId, next[roleId]!);
  }

  const rulesSb = decisionRulesClient(options?.authorization);
  const ruleResult = await upsertFixedFunctionRule(deviceId.trim(), roleId, next[roleId], {
    authorization: options?.authorization,
    supabase: rulesSb ?? undefined,
  });
  if (!ruleResult.ok) {
    return {
      ok: false,
      error: `Tipagem salva, mas regra ${FN_RULE_IDS[roleId]} falhou: ${ruleResult.error}`,
    };
  }

  if (roleId === 'circulation_pump') {
    const circBinding = next.circulation_pump
      ? {
          slaveMac: next.circulation_pump.slaveMac,
          relayIndex: next.circulation_pump.relayIndex,
        }
      : null;
    await notifyDeviceCircConfig(deviceId.trim(), circBinding);
  }

  if (rulesSb) {
    await publishFnRuleMqtt(
      deviceId.trim(),
      ruleResult.ruleId,
      ruleResult.action,
      rulesSb,
      ruleResult.retiredRuleIds ?? []
    );
  }

  return {
    ok: true,
    roles: next,
    ruleId: ruleResult.ruleId,
    ruleAction: ruleResult.action,
  };
}

/** Guarda mapa completo (legado) + sincroniza todas as fn_*. */
export async function saveHydraulicRolesForDevice(
  deviceId: string,
  roles: HydraulicRolesMap,
  options?: HydraulicRolesSaveOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente' };
  }

  const validationErrors = validateHydraulicRolesMap(roles);
  if (validationErrors.length > 0) {
    return { ok: false, error: validationErrors.join('; ') };
  }

  const persisted = await persistRolesMap(deviceId.trim(), roles);
  if (!persisted.ok) return persisted;

  for (const def of HYDRAULIC_ROLE_DEFINITIONS) {
    const binding = roles[def.id];
    if (!binding) continue;
    await renameRoleRelay(deviceId.trim(), def.id, binding);
  }

  const rulesSb = decisionRulesClient(options?.authorization);

  for (const def of HYDRAULIC_ROLE_DEFINITIONS) {
    const ruleResult = await upsertFixedFunctionRule(
      deviceId.trim(),
      def.id,
      roles[def.id],
      {
        authorization: options?.authorization,
        supabase: rulesSb ?? undefined,
      }
    );
    if (!ruleResult.ok) {
      return {
        ok: false,
        error: `Tipagem salva, mas regra ${def.id} falhou: ${ruleResult.error}`,
      };
    }
    if (rulesSb) {
      await publishFnRuleMqtt(
        deviceId.trim(),
        ruleResult.ruleId,
        ruleResult.action,
        rulesSb,
        ruleResult.retiredRuleIds ?? []
      );
    }
  }

  const circBinding = roles.circulation_pump
    ? {
        slaveMac: roles.circulation_pump.slaveMac,
        relayIndex: roles.circulation_pump.relayIndex,
      }
    : null;
  await notifyDeviceCircConfig(deviceId.trim(), circBinding);

  return { ok: true };
}
