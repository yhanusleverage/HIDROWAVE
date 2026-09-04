/**
 * MQTT híbrido decision_rules → Core SPIFFS.
 * - Upsert por rule_id: hidrowave/{id}/rules/{rule_id} retained
 * - Manifest: hidrowave/{id}/rules/manifest retained
 */
import { createHash } from 'crypto';
import { validateDeviceId } from '@/lib/mqtt-relay-command-schema';

async function publishMqttRetained(
  topic: string,
  body: unknown
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const host = process.env.MQTT_HOST;
  const user = process.env.MQTT_PUBLISH_USER || process.env.MQTT_USER;
  const pass = process.env.MQTT_PUBLISH_PASS || process.env.MQTT_PASS;
  const port = parseInt(process.env.MQTT_PORT || '1883', 10);

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[MQTT RULES] skip — MQTT_HOST + creds');
    }
    return { ok: false, skipped: true };
  }

  const mqtt = await import('mqtt');

  return new Promise((resolve) => {
    const client = mqtt.connect(`mqtt://${host}:${port}`, {
      username: user,
      password: pass,
      connectTimeout: 5000,
    });

    let settled = false;
    const finish = (result: { ok: boolean; skipped?: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    client.on('connect', () => {
      client.publish(topic, JSON.stringify(body), { qos: 1, retain: true }, (err) => {
        if (err) finish({ ok: false, error: err.message });
        else {
          console.log(`[MQTT RULES] retained → ${topic}`);
          finish({ ok: true });
        }
      });
    });

    client.on('error', (err) => finish({ ok: false, error: err.message }));
    setTimeout(() => finish({ ok: false, error: 'mqtt connect timeout' }), 6000);
  });
}

export function mqttRuleUpsertTopic(deviceId: string, ruleId: string): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT RULES] device_id inválido: ${deviceId}`);
  }
  const safe = ruleId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `hidrowave/${deviceId}/rules/${safe}`;
}

export function mqttRulesManifestTopic(deviceId: string): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT RULES] device_id inválido: ${deviceId}`);
  }
  return `hidrowave/${deviceId}/rules/manifest`;
}

export function hashRulePayload(rule: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(rule)).digest('hex').slice(0, 16);
}

/** Remove campos só-UI / lixo que quebra o DE (conditions:[] sem script). */
function slimRuleJsonForMqtt(ruleJson: unknown): Record<string, unknown> {
  if (!ruleJson || typeof ruleJson !== 'object' || Array.isArray(ruleJson)) {
    return {};
  }
  const src = { ...(ruleJson as Record<string, unknown>) };
  delete src.description_note;

  const conditions = src.conditions;
  if (Array.isArray(conditions) && conditions.length === 0) {
    delete src.conditions;
  }
  // Preferir condition singular; se conditions vazio já removido
  return src;
}

export function buildRuleUpsertMqttPayload(
  deviceId: string,
  row: {
    rule_id: string;
    rule_name?: string;
    rule_description?: string;
    rule_json?: unknown;
    enabled?: boolean;
    priority?: number;
  },
  op: 'upsert' | 'disable' | 'delete' = 'upsert'
): Record<string, unknown> {
  const ruleJson = slimRuleJsonForMqtt(row.rule_json);
  const ruleBody: Record<string, unknown> = {
    rule_id: row.rule_id,
    rule_name: row.rule_name ?? row.rule_id,
    rule_description: row.rule_description ?? '',
    enabled: op === 'disable' || op === 'delete' ? false : Boolean(row.enabled),
    priority: row.priority ?? 50,
    rule_json: ruleJson,
  };
  if (ruleJson.condition != null) ruleBody.condition = ruleJson.condition;
  if (Array.isArray(ruleJson.conditions) && ruleJson.conditions.length > 0) {
    ruleBody.conditions = ruleJson.conditions;
  }
  if (ruleJson.actions != null) ruleBody.actions = ruleJson.actions;
  if (ruleJson.script != null) ruleBody.script = ruleJson.script;
  if (ruleJson.interval_between_executions != null) {
    ruleBody.interval_between_executions = ruleJson.interval_between_executions;
  }
  return {
    v: 1,
    op,
    device_id: deviceId,
    rule_id: row.rule_id,
    hash: hashRulePayload(ruleBody),
    rule: ruleBody,
  };
}

export async function notifyDeviceRuleUpsert(
  deviceId: string,
  row: {
    rule_id: string;
    rule_name?: string;
    rule_description?: string;
    rule_json?: unknown;
    enabled?: boolean;
    priority?: number;
  },
  op: 'upsert' | 'disable' | 'delete' = 'upsert'
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  let topic: string;
  let body: Record<string, unknown>;
  try {
    topic = mqttRuleUpsertTopic(deviceId, row.rule_id);
    body = buildRuleUpsertMqttPayload(deviceId, row, op);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('[MQTT RULES] schema:', error);
    return { ok: false, error };
  }
  const result = await publishMqttRetained(topic, body);
  if (!result.ok && !result.skipped) {
    console.warn(`[MQTT RULES] upsert falhou (${row.rule_id}):`, result.error);
  }
  return result;
}

export async function notifyDeviceRulesManifest(
  deviceId: string,
  entries: Array<{ rule_id: string; hash: string; enabled: boolean }>
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  let topic: string;
  try {
    topic = mqttRulesManifestTopic(deviceId);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('[MQTT RULES] manifest topic:', error);
    return { ok: false, error };
  }
  const body = {
    v: 1,
    device_id: deviceId,
    ts: Date.now(),
    ids: entries,
  };
  const result = await publishMqttRetained(topic, body);
  if (!result.ok && !result.skipped) {
    console.warn('[MQTT RULES] manifest falhou:', result.error);
  }
  return result;
}

/** Após tipagem / CRUD: upsert + republica manifest do device. */
export async function syncDecisionRuleToDevice(
  deviceId: string,
  row: {
    rule_id: string;
    rule_name?: string;
    rule_description?: string;
    rule_json?: unknown;
    enabled?: boolean;
    priority?: number;
  },
  op: 'upsert' | 'disable' | 'delete' = 'upsert'
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  return notifyDeviceRuleUpsert(deviceId, row, op);
}
