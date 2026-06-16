import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  validateEcNutrientsAssignment,
  type EcNutrientRelaySlice,
} from '@/lib/relay-allocation';
import {
  stripEcWritableConfig,
  sanitizeEcNumericFields,
  configApiErrorResponse,
} from '@/lib/controller-config-api';

/**
 * API para gerenciar configuração do EC Controller (ec_config_view).
 */
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
      .from('ec_config_view')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        device_id: deviceId,
        base_dose: 0,
        flow_rate: 0,
        volume: 0,
        total_ml: 0,
        kp: 1.0,
        ec_setpoint: 0,
        tolerance: 50,
        auto_enabled: false,
      });
    }

    if (error) {
      return NextResponse.json(
        configApiErrorResponse(error.message || 'Erro ao buscar ec_config_view', 500, {
          code: error.code,
        }),
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro em GET /api/ec-controller/config:', error);
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

    const writableConfig = sanitizeEcNumericFields(
      stripEcWritableConfig(rawConfig as Record<string, unknown>)
    );

    const nutrients = writableConfig.nutrients as EcNutrientRelaySlice[] | undefined;

    const { data: phRow } = await supabase
      .from('ph_config_view')
      .select('relay_ph_up, relay_ph_down')
      .eq('device_id', device_id)
      .maybeSingle();

    const ecRelayCheck = validateEcNutrientsAssignment(nutrients, phRow ?? undefined);
    if (!ecRelayCheck.ok) {
      return NextResponse.json(
        configApiErrorResponse(
          ecRelayCheck.error || 'Conflito de relés EC/pH',
          400,
          { code: 'RELAY_CONFLICT' }
        ),
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('ec_config_view')
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
      console.error('Erro ao salvar config EC Controller:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        device_id,
        keys: Object.keys(writableConfig),
      });
      return NextResponse.json(
        configApiErrorResponse(
          error.message || 'Falha ao gravar ec_config_view',
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
    console.error('Erro em POST /api/ec-controller/config:', error);
    return NextResponse.json(
      configApiErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      ),
      { status: 500 }
    );
  }
}
