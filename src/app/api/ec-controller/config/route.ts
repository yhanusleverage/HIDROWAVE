import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para gerenciar configuração do EC Controller
 * 
 * ✅ CORRIGIDO: Agora usa APENAS Supabase (sem fetch direto a IP privada)
 * Isso permite que o sistema funcione em produção (Vercel) de qualquer lugar do mundo
 * 
 * GET: Busca configuração do EC Controller do Supabase
 * POST: Salva configuração do EC Controller no Supabase
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
    
    const { data, error } = await supabase
      .from('ec_controller_config')
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
    
    const { data, error } = await supabase
      .from('ec_controller_config')
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
      console.error('Erro ao salvar config EC Controller:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro em POST /api/ec-controller/config:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

