import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

const VALID_TYPES = ['daily', 'weekly', 'grow_week'] as const;

// GET — listar schedules de um device
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    if (!deviceId) {
      return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('rule_schedules')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ schedules: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST — crear schedule
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      rule_id,
      schedule_type,
      time_start,
      time_end,
      days_of_week,
      grow_week_index,
      timezone = 'America/Sao_Paulo',
      enabled = true,
      created_by = 'web_interface',
    } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    }
    if (!rule_id || rule_id.length < 3) {
      return NextResponse.json({ error: 'rule_id required (min 3 chars)' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(schedule_type)) {
      return NextResponse.json(
        { error: `schedule_type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!time_start) {
      return NextResponse.json({ error: 'time_start required (HH:MM)' }, { status: 400 });
    }

    const row: Record<string, unknown> = {
      device_id,
      rule_id,
      schedule_type,
      time_start,
      timezone,
      enabled,
      created_by,
    };
    if (time_end) row.time_end = time_end;
    if (Array.isArray(days_of_week) && days_of_week.length > 0) row.days_of_week = days_of_week;
    if (grow_week_index != null) row.grow_week_index = grow_week_index;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('rule_schedules')
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH — update schedule
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    if (updates.schedule_type && !VALID_TYPES.includes(updates.schedule_type)) {
      return NextResponse.json(
        { error: `schedule_type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('rule_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ schedule: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE — eliminar schedule
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('rule_schedules').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
