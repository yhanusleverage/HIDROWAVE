/**
 * MQTT híbrido decision_rules → Core SPIFFS.
 * - Upsert por rule_id: hidrowave/{id}/rules/{rule_id} retained
 * - Manifest: hidrowave/{id}/rules/manifest retained
 * - procedure/cmd: hidrowave/{id}/procedure/cmd (não retained — Start/Abort/Rearm)
 */
import { createHash } from 'crypto';
import { validateDeviceId } from '@/lib/mqtt-relay-command-schema';

async function publishMqtt(
  topic: string,
  body: unknown,
  options?: { retain?: boolean }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const host = process.env.MQTT_HOST;
  const user = process.env.MQTT_PUBLISH_USER || process.env.MQTT_USER;
  const pass = process.env.MQTT_PUBLISH_PASS || process.env.MQTT_PASS;
  const port = parseInt(process.env.MQTT_PORT || '1883', 10);
  const retain = options?.retain ?? false;

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
      client.publish(topic, JSON.stringify(body), { qos: 1, retain }, (err) => {
        if (err) finish({ ok: false, error: err.message });
        else {
          console.log(`[MQTT] ${retain ? 'retained' : 'cmd'} → ${topic}`);
          finish({ ok: true });
        }
      });
    });

    client.on('error', (err) => finish({ ok: false, error: err.message }));
    setTimeout(() => finish({ ok: false, error: 'mqtt connect timeout' }), 6000);
  });
}

async function publishMqttRetained(
  topic: string,
  body: unknown
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  return publishMqtt(topic, body, { retain: true });
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

export function mqttProcedureCmdTopic(deviceId: string): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT RULES] device_id inválido: ${deviceId}`);
  }
  return `hidrowave/${deviceId}/procedure/cmd`;
}

export function hashRulePayload(rule: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(rule)).digest('hex').slice(0, 16);
}

/** Procedimento de tanque (FSM) — candidato a Start/Abort via procedure/cmd. */
export function isTankProcedureRuleJson(ruleJson: unknown): boolean {
  if (!ruleJson || typeof ruleJson !== 'object' || Array.isArray(ruleJson)) {
    return false;
  }
  const rj = ruleJson as Record<string, unknown>;
  if (rj.fsm && typeof rj.fsm === 'object') return true;
  const kind = String(rj.procedure_kind ?? '');
  if (
    kind === 'full_recharge' ||
    kind === 'drain_only' ||
    kind === 'fill_only' ||
    kind === 'generic'
  ) {
    return true;
  }
  if (rj.execution_class === 'procedure') return true;
  if (Array.isArray(rj.procedure_steps) && rj.procedure_steps.length > 0) return true;
  if (rj.procedure_canonical && typeof rj.procedure_canonical === 'object') return true;
  return false;
}

export type ProcedureCmdOp = 'start' | 'abort' | 'rearm';

/**
 * Comando FSM tanque (não retained).
 * Salvar = só upsert (Armed). Ativar = upsert + start. Desativar = abort + disable.
 */
export async function notifyDeviceProcedureCmd(
  deviceId: string,
  ruleId: string,
  op: ProcedureCmdOp
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  let topic: string;
  try {
    topic = mqttProcedureCmdTopic(deviceId);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
  const body = {
    v: 1,
    device_id: deviceId,
    rule_id: ruleId,
    op,
  };
  const result = await publishMqtt(topic, body, { retain: false });
  if (!result.ok && !result.skipped) {
    console.warn(`[MQTT] procedure/cmd ${op} falhou (${ruleId}):`, result.error);
  }
  return result;
}

/**
 * Remove campos só-UI / pesados que o ESP não precisa executar.
 * procedure_steps / procedure_canonical ficam no Supabase; no Master basta script + fsm.
 * Reduz envelope MQTT (Full recharge) e evita overflow do doc 16k.
 */
function slimRuleJsonForMqtt(ruleJson: unknown): Record<string, unknown> {
  if (!ruleJson || typeof ruleJson !== 'object' || Array.isArray(ruleJson)) {
    return {};
  }
  const src = { ...(ruleJson as Record<string, unknown>) };
  delete src.description_note;
  delete src.procedure_steps;
  delete src.procedure_canonical;

  const conditions = src.conditions;
  if (Array.isArray(conditions) && conditions.length === 0) {
    delete src.conditions;
  }
  const actions = src.actions;
  if (Array.isArray(actions) && actions.length === 0) {
    delete src.actions;
  }

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
