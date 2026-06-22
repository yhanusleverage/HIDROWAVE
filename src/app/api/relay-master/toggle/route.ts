import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * ✅ API OTIMIZADA: Toggle rápido de relé Master (Local)
 * 
 * Estrutura: relay_master (1 linha por device, múltiplas colunas)
 * 
 * Vantagens:
 * - UPDATE de 1 linha (muito rápido)
 * - Campos explícitos (relay_X_state)
 * - Sem necessidade de WHERE relay_number
 * 
 * @example
 * POST /api/relay-master/toggle
 * {
 *   "device_id": "ESP32_HIDRO_XXXXX",
 *   "relay_number": 2,
 *   "state": true,
 *   "has_timer": false,
 *   "remaining_time": 0
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      relay_number,      // 0-15
      state,             // true/false
      has_timer = false,
      remaining_time = 0,
    } = body;

    // Validações
    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }

    if (typeof relay_number !== 'number' || relay_number < 0 || relay_number > 15) {
      return NextResponse.json(
        { error: 'relay_number inválido (0-15)' },
        { status: 400 }
      );
    }

    if (typeof state !== 'boolean') {
      return NextResponse.json(
        { error: 'state deve ser boolean (true/false)' },
        { status: 400 }
      );
    }

    // ✅ Construir nome da coluna dinamicamente
    const relayStateCol = `relay_${relay_number}_state`;
    const relayTimerCol = `relay_${relay_number}_has_timer`;
    const relayTimeCol = `relay_${relay_number}_remaining_time`;

    // ✅ UPDATE otimizado: 1 linha, campos explícitos
    const { data, error } = await supabase
      .from('relay_master')
      .update({
        [relayStateCol]: state,
        [relayTimerCol]: has_timer,
        [relayTimeCol]: remaining_time,
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', device_id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar relé master:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar relé master', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Relé ${relay_number} ${state ? 'ligado' : 'desligado'}`,
      device_id,
      relay_number,
      state,
      data,
    });
  } catch (error) {
    console.error('Erro em POST /api/relay-master/toggle:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

