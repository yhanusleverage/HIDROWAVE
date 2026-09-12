import { NextResponse } from 'next/server';
import {
  getSupabaseServerClient,
  getSupabaseWriterForDecisionRules,
} from '@/lib/supabase-server';
import {
  notifyDeviceRuleUpsert,
  notifyDeviceRulesManifest,
  notifyDeviceProcedureCmd,
  hashRulePayload,
  isTankProcedureRuleJson,
  type ProcedureCmdOp,
} from '@/lib/mqtt-rules-publish';
import { rematerializeRuleJsonForDevice } from '@/lib/rule-procedure/rematerialize-rule-json';

type SyncOp = 'upsert' | 'disable' | 'delete';

/**
 * POST — publica decision_rule no Core (MQTT retained) + opcional procedure/cmd.
 * Body: { …, op?, procedure_op?: 'start'|'abort'|'rearm'|'none' }
 * - Salvar: upsert sem procedure_op → Armed
 * - Ativar: upsert + procedure_op=start
 * - Desativar: procedure_op=abort + disable
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

    const rawProcOp = body.procedure_op;
    let procedureOp: ProcedureCmdOp | 'none' | undefined;
    if (rawProcOp === 'start' || rawProcOp === 'abort' || rawProcOp === 'rearm') {
      procedureOp = rawProcOp;
    } else if (rawProcOp === 'none') {
      procedureOp = 'none';
    }

    const writer =
      getSupabaseWriterForDecisionRules(request.headers.get('authorization')) ??
      null;
    const sb = writer?.client ?? getSupabaseServerClient();

    let ruleJson = body.rule_json;
    let ruleName = body.rule_name ?? undefined;
    let ruleDescription = body.rule_description ?? undefined;
    let priority =
      typeof body.priority === 'number' ? body.priority : undefined;

    if (op === 'upsert') {
      if (ruleJson == null) {
        const { data: row } = await sb
          .from('decision_rules')
          .select('rule_name, rule_description, rule_json, priority')
          .eq('device_id', deviceId)
          .eq('rule_id', ruleId)
          .maybeSingle();
        if (row) {
          ruleJson = row.rule_json;
          ruleName = ruleName ?? row.rule_name ?? undefined;
          ruleDescription = ruleDescription ?? row.rule_description ?? undefined;
          priority = priority ?? row.priority ?? undefined;
        }
      }

      const remat = await rematerializeRuleJsonForDevice(
        deviceId,
        ruleId,
        ruleName,
        ruleJson
      );
      if (!remat.ok) {
        return NextResponse.json({ error: remat.error }, { status: 422 });
      }
      ruleJson = remat.ruleJson;

      await sb
        .from('decision_rules')
        .update({
          rule_json: ruleJson,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId)
        .eq('rule_id', ruleId);
    } else if (ruleJson == null && (procedureOp === 'abort' || procedureOp === 'start')) {
      const { data: row } = await sb
        .from('decision_rules')
        .select('rule_json')
        .eq('device_id', deviceId)
        .eq('rule_id', ruleId)
        .maybeSingle();
      ruleJson = row?.rule_json;
    }

    const tankLike = isTankProcedureRuleJson(ruleJson);

    // Desativar tanque: abort antes do disable (para OFF limpo se estava Running)
    if (
      tankLike &&
      (op === 'disable' || op === 'delete') &&
      procedureOp !== 'none'
    ) {
      const abortOp = procedureOp === 'abort' || procedureOp == null ? 'abort' : procedureOp;
      if (abortOp === 'abort') {
        await notifyDeviceProcedureCmd(deviceId, ruleId, 'abort');
      }
    }

    const pub = await notifyDeviceRuleUpsert(
      deviceId,
      {
        rule_id: ruleId,
        rule_name: ruleName,
        rule_description: ruleDescription,
        rule_json: ruleJson,
        enabled: Boolean(body.enabled),
        priority,
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

    // Ativar tanque: após Armed (upsert enabled), Start
    // Pequeno delay: upsert e cmd usam conexões MQTT distintas — dá tempo ao Core carregar Armed
    let procedureCmd: { op: ProcedureCmdOp; ok: boolean } | null = null;
    if (tankLike && op === 'upsert' && Boolean(body.enabled) && procedureOp === 'start') {
      await new Promise((r) => setTimeout(r, 400));
      const cmd = await notifyDeviceProcedureCmd(deviceId, ruleId, 'start');
      procedureCmd = { op: 'start', ok: cmd.ok || Boolean(cmd.skipped) };
      if (!cmd.ok && !cmd.skipped) {
        console.warn('[rules/sync] procedure start:', cmd.error);
      }
    }

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

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      rule_id: ruleId,
      op,
      procedure_cmd: procedureCmd,
    });
  } catch (e) {
    console.error('[rules/sync]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
