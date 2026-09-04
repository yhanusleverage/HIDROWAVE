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

/**
 * POST { device_id } — republica todas as decision_rules (upsert retained + manifest).
 * Usar após boot / “Resync regras” na UI.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const writer = getSupabaseWriterForDecisionRules(
      request.headers.get('authorization')
    );
    const sb = writer?.client ?? getSupabaseServerClient();
    const { data, error } = await sb
      .from('decision_rules')
      .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
      .eq('device_id', deviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    for (const row of rows) {
      const enabled = Boolean(row.enabled);
      await notifyDeviceRuleUpsert(
        deviceId,
        {
          rule_id: String(row.rule_id),
          rule_name: row.rule_name ?? undefined,
          rule_description: row.rule_description ?? undefined,
          rule_json: row.rule_json,
          enabled,
          priority: row.priority ?? undefined,
        },
        enabled ? 'upsert' : 'disable'
      );
    }

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

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      republished: rows.length,
    });
  } catch (e) {
    console.error('[rules/resync]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
