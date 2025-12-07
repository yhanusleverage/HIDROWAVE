import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para gerenciar configuração do EC Controller
 * 
 * ✅ NOVA ARQUITETURA: Usa ec_config_view (similar a relay_slaves)
 * 
 * GET: Busca configuração do EC Controller de ec_config_view
 * POST: Salva configuração do EC Controller em ec_config_view (view table)
 * 
 * FLUXO:
 * 1. "Salvar Parâmetros" → POST salva em ec_config_view
 * 2. "Ativar Auto EC" → Chama RPC activate_auto_ec que lê ec_config_view
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    
    if (!deviceId) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }
    
    // ✅ NOVA ARQUITETURA: Usar ec_config_view (view table)
    const { data, error } = await supabase
      .from('ec_config_view')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    // Se não encontrou, retornar config padrão
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        device_id: deviceId,
        base_dose: 0,
        flow_rate: 0,
        volume: 0,
        total_ml: 0,
        kp: 1.0,
        ec_setpoint: 0,
        auto_enabled: false,
      });
    }
    
    if (error) {
      console.error('Erro ao buscar config EC Controller:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro em GET /api/ec-controller/config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, ...config } = body;
    
    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }
    
    // ✅ NOVA ARQUITETURA: Salvar em ec_config_view (view table)
    const { data, error } = await supabase
      .from('ec_config_view')
      .upsert({
        device_id,
        ...config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'device_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao salvar config EC Controller:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        body: body
      });
      return NextResponse.json(
        { 
          error: error.message || 'Erro desconhecido',
          code: error.code,
          details: error.details,
          hint: error.hint
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro em POST /api/ec-controller/config:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

