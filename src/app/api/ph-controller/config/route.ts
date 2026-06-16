import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  validatePhRelayAssignment,
  type EcNutrientRelaySlice,
} from '@/lib/relay-allocation';
import {
  stripPhWritableConfig,
  sanitizePhNumericFields,
  configApiErrorResponse,
} from '@/lib/controller-config-api';

const DEFAULT_PH_CONFIG = {
  ph_setpoint: 6.0,
  ph_tolerance: 0.2,
  flow_rate_ph_up: 1.0,
  flow_rate_ph_down: 1.0,
  volume: 100,
  ml_per_ph_unit: 2.0,
  ml_per_ph_unit_acid: 2.0,
  ml_per_ph_unit_base: 2.0,
  relay_ph_up: 1,
  relay_ph_down: 0,
  auto_enabled: false,
  intervalo_auto_ph: 300,
  tempo_recirculacao: 60,
  aggressiveness: 0.5,
  gain_alpha: 0.2,
  k_acid: null,
  k_base: null,
  max_dose_ml_per_cycle: 50,
  max_pulse_seconds: 120,
  max_consecutive_corrections: 5,
  reset_k_gains: false,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');

    if (!deviceId) {
      return NextResponse.json(
        configApiErrorResponse('device_id é obrigatório', 400),
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('ph_config_view')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({ device_id: deviceId, ...DEFAULT_PH_CONFIG });
    }

    if (error) {
      return NextResponse.json(
        configApiErrorResponse(error.message || 'Erro ao buscar ph_config_view', 500, {
          code: error.code,
        }),
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      configApiErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      ),
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, ...rawConfig } = body;

    if (!device_id || typeof device_id !== 'string') {
      return NextResponse.json(
        configApiErrorResponse('device_id é obrigatório', 400),
        { status: 400 }
      );
    }

    let writableConfig = sanitizePhNumericFields(
      stripPhWritableConfig(rawConfig as Record<string, unknown>)
    );

    const { data: existingPh } = await supabase
      .from('ph_config_view')
      .select('relay_ph_up, relay_ph_down')
      .eq('device_id', device_id)
      .maybeSingle();

    const relayPhUp = Number(
      writableConfig.relay_ph_up ?? existingPh?.relay_ph_up ?? 1
    );
    const relayPhDown = Number(
      writableConfig.relay_ph_down ?? existingPh?.relay_ph_down ?? 0
    );

    const { data: ecRow } = await supabase
      .from('ec_config_view')
      .select('nutrients')
      .eq('device_id', device_id)
      .maybeSingle();

    const phRelayCheck = validatePhRelayAssignment(
      relayPhUp,
      relayPhDown,
      (ecRow?.nutrients as EcNutrientRelaySlice[] | null) ?? []
    );
    if (!phRelayCheck.ok) {
      return NextResponse.json(
        configApiErrorResponse(
          phRelayCheck.error || 'Conflito de relés pH/EC',
          400,
          { code: 'RELAY_CONFLICT' }
        ),
        { status: 400 }
      );
    }

    if (typeof writableConfig.aggressiveness === 'number') {
      const a = writableConfig.aggressiveness as number;
      writableConfig.aggressiveness = Math.min(1, Math.max(0.05, a));
    }
    if (typeof writableConfig.gain_alpha === 'number') {
      const alpha = writableConfig.gain_alpha as number;
      writableConfig.gain_alpha = Math.min(0.5, Math.max(0.05, alpha));
    }

    const acid = writableConfig.ml_per_ph_unit_acid;
    const base = writableConfig.ml_per_ph_unit_base;
    if (typeof acid === 'number' && typeof base === 'number') {
      writableConfig.ml_per_ph_unit = (acid + base) / 2;
    } else if (typeof acid === 'number') {
      writableConfig.ml_per_ph_unit = acid;
    } else if (typeof base === 'number') {
      writableConfig.ml_per_ph_unit = base;
    }

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
      console.error('Erro ao salvar config pH:', {
        message: error.message,
        code: error.code,
        device_id,
        keys: Object.keys(writableConfig),
      });
      return NextResponse.json(
        configApiErrorResponse(
          error.message || 'Falha ao gravar ph_config_view',
          500,
          {
            code: error.code,
            details: error.details,
            hint: error.hint,
          }
        ),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      configApiErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      ),
      { status: 500 }
    );
  }
}
