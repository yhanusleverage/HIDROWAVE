import { supabase } from '@/lib/supabase';

/** Cabeçalho Bearer da sessão (RLS / APIs server). */
async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export type DecisionRuleMqttOp = 'upsert' | 'disable' | 'delete';

/** Após CRUD no browser: empurra a regra ao Core via MQTT. */
export async function requestDecisionRuleMqttSync(params: {
  device_id: string;
  rule_id: string;
  rule_name?: string;
  rule_description?: string;
  rule_json?: unknown;
  enabled?: boolean;
  priority?: number;
  op?: DecisionRuleMqttOp;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await authHeaders();
    const enabled = Boolean(params.enabled);
    // disable = enabled:false no Core (mantém regra). delete remove. upsert cria/atualiza.
    let op: DecisionRuleMqttOp = params.op ?? 'upsert';
    if (op !== 'upsert' && op !== 'disable' && op !== 'delete') {
      op = 'upsert';
    }
    if (op === 'upsert' && !enabled) {
      op = 'disable';
    }

    const res = await fetch('/api/automation/rules/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...params, enabled, op }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' };
  }
}

/** Republica todas as regras do device (boot / Resync UI). */
export async function requestDecisionRulesResync(
  deviceId: string
): Promise<{ ok: boolean; republished?: number; error?: string }> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/automation/rules/resync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ device_id: deviceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? res.statusText };
    }
    return { ok: true, republished: data.republished };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' };
  }
}
