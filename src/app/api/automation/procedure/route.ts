import { NextResponse } from 'next/server';
import { saveProcedureToDecisionRulesServer } from '@/lib/rule-procedure/save-procedure-server';
import type { RuleProcedure } from '@/lib/rule-procedure/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const procedure = body.procedure as RuleProcedure | undefined;
    const createdBy = body.created_by ? String(body.created_by) : undefined;

    if (!deviceId || !procedure) {
      return NextResponse.json(
        { error: 'device_id e procedure são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await saveProcedureToDecisionRulesServer(deviceId, procedure, createdBy);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      rule_db_id: result.ruleDbId,
      created: result.created,
    });
  } catch (error) {
    console.error('[automation/procedure] POST', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
