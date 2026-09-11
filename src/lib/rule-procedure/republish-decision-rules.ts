import type { SupabaseClient } from '@supabase/supabase-js';
import {
  notifyDeviceRuleUpsert,
  notifyDeviceRulesManifest,
  hashRulePayload,
} from '@/lib/mqtt-rules-publish';
import { rematerializeRuleJsonForDevice } from '@/lib/rule-procedure/rematerialize-rule-json';

export type RepublishRulesResult = {
  ok: true;
  republished: number;
  skippedTipagem: string[];
};

/**
 * Rematerializa + MQTT retained para todas as decision_rules do device.
 * Tipagem P1 só recirculação; dreno/fill herdam MAC da circulação no rematerialize.
 */
export async function republishAllDecisionRulesForDevice(
  deviceId: string,
  sb: SupabaseClient
): Promise<RepublishRulesResult | { ok: false; error: string }> {
  const { data, error } = await sb
    .from('decision_rules')
    .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
    .eq('device_id', deviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = data ?? [];
  const published: Array<{ rule_id: string; hash: string; enabled: boolean }> = [];
  const skippedTipagem: string[] = [];
  let republished = 0;

  for (const row of rows) {
    const enabled = Boolean(row.enabled);
    let ruleJson = (row.rule_json ?? {}) as Record<string, unknown>;

    if (enabled) {
      const remat = await rematerializeRuleJsonForDevice(
        deviceId,
        String(row.rule_id),
        row.rule_name ?? undefined,
        ruleJson
      );
      if (remat.ok) {
        ruleJson = remat.ruleJson;
        await sb
          .from('decision_rules')
          .update({
            rule_json: ruleJson,
            updated_at: new Date().toISOString(),
          })
          .eq('device_id', deviceId)
          .eq('rule_id', row.rule_id);
      }
    }

    await notifyDeviceRuleUpsert(
      deviceId,
      {
        rule_id: String(row.rule_id),
        rule_name: row.rule_name ?? undefined,
        rule_description: row.rule_description ?? undefined,
        rule_json: ruleJson,
        enabled,
        priority: row.priority ?? undefined,
      },
      enabled ? 'upsert' : 'disable'
    );
    republished += 1;

    published.push({
      rule_id: String(row.rule_id),
      hash: hashRulePayload({
        rule_id: row.rule_id,
        rule_name: row.rule_name,
        rule_description: row.rule_description,
        enabled,
        priority: row.priority ?? 50,
        rule_json: ruleJson,
      }),
      enabled,
    });
  }

  await notifyDeviceRulesManifest(deviceId, published);

  return { ok: true, republished, skippedTipagem };
}
