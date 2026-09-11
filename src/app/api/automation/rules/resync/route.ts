import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseWriterForDecisionRules,
} from '@/lib/supabase-server';
import { republishAllDecisionRulesForDevice } from '@/lib/rule-procedure/republish-decision-rules';

/**
 * POST { device_id } — republica decision_rules (MQTT retained + manifest).
 * Rematerializa tipagem; procedimentos de tanque sem tipagem são ignorados (não empurram R0).
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
    const result = await republishAllDecisionRulesForDevice(deviceId, sb);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      republished: result.republished,
      skipped_tipagem: result.skippedTipagem,
    });
  } catch (e) {
    console.error('[rules/resync]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
