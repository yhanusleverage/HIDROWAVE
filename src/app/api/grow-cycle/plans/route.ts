import { NextResponse } from 'next/server';
import { isUnknownSupabaseMissingTableError } from '@/lib/db-schema';
import {
  createGrowCyclePlan,
  deleteGrowCyclePlan,
  getActiveGrowCycleInstance,
  getGrowCyclePlanById,
  listGrowCyclePlans,
  updateGrowCyclePlan,
} from '@/lib/grow-cycle-plans/grow-cycle-plans-server';
import { validateGrowCyclePlan } from '@/lib/grow-cycle-plans/validate-grow-plan';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';

function missingTableResponse() {
  return NextResponse.json(
    {
      error: 'Tabelas grow_cycle_plans ausentes — executar scripts/migrations/20250710_grow_cycle_and_rollups.sql',
      table_available: false,
    },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const planId = searchParams.get('id');
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | null;

    if (planId) {
      const plan = await getGrowCyclePlanById(planId);
      if (!plan) {
        return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
      }
      return NextResponse.json({ plan, table_available: true });
    }

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id ou id é obrigatório' }, { status: 400 });
    }

    const { plans, tableAvailable } = await listGrowCyclePlans(
      deviceId,
      status ?? undefined
    );

    if (!tableAvailable) {
      return NextResponse.json({ plans: [], table_available: false });
    }

    const instance = await getActiveGrowCycleInstance(deviceId);

    return NextResponse.json({
      plans,
      active_instance: instance,
      table_available: true,
    });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) return missingTableResponse();
    console.error('[grow-cycle/plans] GET', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = String(body.device_id ?? '').trim();
    const planJson = body.plan_json as GrowCyclePlan | undefined;
    const name = String(body.name ?? planJson?.name ?? '').trim();

    if (!deviceId || !planJson) {
      return NextResponse.json(
        { error: 'device_id e plan_json são obrigatórios' },
        { status: 400 }
      );
    }

    const validation = validateGrowCyclePlan(planJson);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Plano inválido', details: validation.errors }, { status: 400 });
    }

    const plan = await createGrowCyclePlan({
      deviceId,
      name: name || planJson.name,
      totalWeeks: planJson.totalWeeks,
      planJson,
      status: body.status ?? 'draft',
    });

    return NextResponse.json({ plan, table_available: true }, { status: 201 });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) return missingTableResponse();
    console.error('[grow-cycle/plans] POST', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id ?? '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    if (body.plan_json) {
      const validation = validateGrowCyclePlan(body.plan_json as GrowCyclePlan);
      if (!validation.valid) {
        return NextResponse.json({ error: 'Plano inválido', details: validation.errors }, { status: 400 });
      }
    }

    const plan = await updateGrowCyclePlan(id, {
      name: body.name,
      totalWeeks: body.total_weeks,
      planJson: body.plan_json,
      status: body.status,
      publishedAt: body.published_at,
    });

    return NextResponse.json({ plan, table_available: true });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) return missingTableResponse();
    console.error('[grow-cycle/plans] PATCH', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    await deleteGrowCyclePlan(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) return missingTableResponse();
    console.error('[grow-cycle/plans] DELETE', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
