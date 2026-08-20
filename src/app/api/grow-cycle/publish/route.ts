import { NextResponse } from 'next/server';
import { isUnknownSupabaseMissingTableError } from '@/lib/db-schema';
import { publishGrowCyclePlan } from '@/lib/grow-cycle-plans/publish-grow-plan';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const plan = body.plan as GrowCyclePlan | undefined;
    const planRowId = body.plan_id ? String(body.plan_id) : undefined;
    const createdBy = body.created_by ? String(body.created_by) : undefined;

    if (!deviceId || !plan) {
      return NextResponse.json(
        { error: 'device_id e plan são obrigatórios' },
        { status: 400 }
      );
    }

    const result = await publishGrowCyclePlan({
      deviceId,
      plan,
      planRowId,
      createdBy,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Falha ao publicar plano',
          details: result.errors,
          partial: {
            plan_id: result.planId,
            rules_created: result.rulesCreated,
            rules_updated: result.rulesUpdated,
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      plan_id: result.planId,
      instance_id: result.instanceId,
      rules_created: result.rulesCreated,
      rules_updated: result.rulesUpdated,
      warnings: result.errors,
    });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) {
      return NextResponse.json(
        {
          error: 'Tabelas grow_cycle ausentes — executar migration SQL',
          table_available: false,
        },
        { status: 503 }
      );
    }
    console.error('[grow-cycle/publish] POST', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
