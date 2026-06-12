import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ph_config_view')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        device_id: deviceId,
        ph_setpoint: 6.0,
        ph_tolerance: 0.2,
        flow_rate_ph_up: 1.0,
        flow_rate_ph_down: 1.0,
        volume: 100,
        ml_per_ph_unit: 2.0,
        relay_ph_up: 1,
        relay_ph_down: 0,
        auto_enabled: false,
        intervalo_auto_ph: 300,
        tempo_recirculacao: 60,
      });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function stripReadOnlyFields(config: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, created_at: _ca, ...rest } = config;
  return rest;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, ...config } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const writableConfig = stripReadOnlyFields(config as Record<string, unknown>);

    const { data, error } = await supabase
      .from('ph_config_view')
      .upsert(
        {
          device_id,
          ...writableConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
