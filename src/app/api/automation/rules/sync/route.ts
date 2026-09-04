import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseWriterForDecisionRules,
} from '@/lib/supabase-server';
import {
  notifyDeviceRuleUpsert,
  notifyDeviceRulesManifest,
  hashRulePayload,
} from '@/lib/mqtt-rules-publish';

type SyncOp = 'upsert' | 'disable' | 'delete';

/**
 * POST — publica uma decision_rule no Core (MQTT retained) + atualiza manifest.
 * Body: { device_id, rule_id, rule_name?, rule_description?, rule_json?, enabled?, priority?, op? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const ruleId = String(body.rule_id ?? '').trim();
    if (!deviceId || !ruleId) {
      return NextResponse.json(
        { error: 'device_id e rule_id são obrigatórios' },
        { status: 400 }
      );
    }

    const op = (String(body.op ?? 'upsert') as SyncOp) || 'upsert';
    if (op !== 'upsert' && op !== 'disable' && op !== 'delete') {
      return NextResponse.json({ error: 'op inválido' }, { status: 400 });
    }

    const pub = await notifyDeviceRuleUpsert(
      deviceId,
      {
        rule_id: ruleId,
        rule_name: body.rule_name ?? undefined,
        rule_description: body.rule_description ?? undefined,
        rule_json: body.rule_json,
        enabled: Boolean(body.enabled),
        priority: typeof body.priority === 'number' ? body.priority : undefined,
      },
      op
    );

    if (!pub.ok) {
      return NextResponse.json(
        {
          error: pub.skipped
            ? 'MQTT não configurado no servidor (MQTT_HOST/creds)'
            : pub.error ?? 'Falha ao publicar regra no MQTT',
          skipped: pub.skipped ?? false,
        },
        { status: 502 }
      );
    }

    const writer =
      getSupabaseWriterForDecisionRules(request.headers.get('authorization')) ??
      null;
    const sb = writer?.client ?? getSupabaseServerClient();
    const { data: rows } = await sb
      .from('decision_rules')
      .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
      .eq('device_id', deviceId);

    if (rows) {
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

    return NextResponse.json({ success: true, device_id: deviceId, rule_id: ruleId, op });
  } catch (e) {
    console.error('[rules/sync]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
