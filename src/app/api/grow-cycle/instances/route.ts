import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { isUnknownSupabaseMissingTableError } from '@/lib/db-schema';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const instanceId = String(body.instance_id ?? '').trim();
    const weekIndex = body.current_week_index;

    if (!instanceId || !Number.isInteger(weekIndex)) {
      return NextResponse.json(
        { error: 'instance_id e current_week_index são obrigatórios' },
        { status: 400 }
      );
    }

    const sb = getSupabaseServerClient();
    const { data, error } = await sb
      .from('grow_cycle_instances')
      .update({ current_week_index: weekIndex })
      .eq('id', instanceId)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ instance: data });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) {
      return NextResponse.json({ error: 'Tabela grow_cycle_instances ausente' }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
