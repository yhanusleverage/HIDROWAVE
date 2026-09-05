import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getHydraulicRolesForDevice } from '@/lib/hydraulic-roles-server';
import {
  notifyDeviceRuleUpsert,
  notifyDeviceRulesManifest,
  hashRulePayload,
} from '@/lib/mqtt-rules-publish';
import type { RuleProcedure } from './types';
import { validateProcedure } from './validate-procedure';
import {
  compileProcedureToPayload,
  materializeProcedureHydraulicRoles,
} from './compile-procedure';

export interface SaveProcedureServerResult {
  ok: boolean;
  error?: string;
  ruleDbId?: string;
  created: boolean;
}

async function publishProcedureRuleMqtt(
  deviceId: string,
  procedure: RuleProcedure,
  ruleJson: unknown
): Promise<void> {
  const op = procedure.enabled ? 'upsert' : 'disable';
  await notifyDeviceRuleUpsert(
    deviceId,
    {
      rule_id: procedure.id,
      rule_name: procedure.name,
      rule_description: procedure.description,
      rule_json: ruleJson,
      enabled: procedure.enabled,
      priority: procedure.priority,
    },
    op
  );

  const sb = getSupabaseServerClient();
  const { data: rows } = await sb
    .from('decision_rules')
    .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
    .eq('device_id', deviceId);
  if (!rows) return;
  await notifyDeviceRulesManifest(
    deviceId,
    rows.map((r) => ({
      rule_id: String(r.rule_id),
      hash: hashRulePayload({
        rule_id: r.rule_id,
        rule_name: r.rule_name,
        rule_description: r.rule_description,
        enabled: Boolean(r.enabled),
        priority: r.priority ?? 50,
        rule_json: r.rule_json ?? {},
      }),
      enabled: Boolean(r.enabled),
    }))
  );
}

export async function saveProcedureToDecisionRulesServer(
  deviceId: string,
  procedure: RuleProcedure,
  createdBy?: string,
  options?: { skipMqtt?: boolean }
): Promise<SaveProcedureServerResult> {
  if (!deviceId?.trim()) {
    return { ok: false, error: 'device_id ausente', created: false };
  }

  const rolesResult = await getHydraulicRolesForDevice(deviceId);
  if (!rolesResult.ok) {
    return { ok: false, error: rolesResult.error, created: false };
  }

  const validation = validateProcedure(procedure, {
    hydraulicRoles: rolesResult.roles,
  });
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('; '), created: false };
  }

  const materialized = materializeProcedureHydraulicRoles(procedure, rolesResult.roles);
  if (materialized.errors.length > 0) {
    return { ok: false, error: materialized.errors.join('; '), created: false };
  }

  let payload;
  try {
    payload = compileProcedureToPayload(materialized.procedure, rolesResult.roles);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erro ao compilar procedimento',
      created: false,
    };
  }

  const ruleJson = {
    ...payload.rule_json,
    procedure_triggers: procedure.triggers,
    procedure_canonical: materialized.procedure,
  };

  const sb = getSupabaseServerClient();

  const { data: existing, error: findErr } = await sb
    .from('decision_rules')
    .select('id')
    .eq('device_id', deviceId.trim())
    .eq('rule_id', procedure.id)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: findErr.message, created: false };
  }

  try {
    if (existing?.id) {
      const { error } = await sb
        .from('decision_rules')
        .update({
          rule_name: procedure.name,
          rule_description: procedure.description ?? null,
          rule_json: ruleJson,
          enabled: procedure.enabled,
          priority: procedure.priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) return { ok: false, error: error.message, created: false };
      if (!options?.skipMqtt) {
        await publishProcedureRuleMqtt(deviceId.trim(), procedure, ruleJson);
      }
      return { ok: true, ruleDbId: existing.id, created: false };
    }

    const { data: created, error } = await sb
      .from('decision_rules')
      .insert({
        device_id: deviceId.trim(),
        rule_id: procedure.id,
        rule_name: procedure.name,
        rule_description: procedure.description ?? null,
        rule_json: ruleJson,
        enabled: procedure.enabled,
        priority: procedure.priority,
        created_by: createdBy ?? 'grow-cycle-publish',
      })
      .select('id')
      .single();

    if (error || !created?.id) {
      return { ok: false, error: error?.message ?? 'Falha ao criar regra', created: false };
    }
    if (!options?.skipMqtt) {
      await publishProcedureRuleMqtt(deviceId.trim(), procedure, ruleJson);
    }
    return { ok: true, ruleDbId: created.id, created: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erro desconhecido',
      created: false,
    };
  }
}
