import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * ✅ API OTIMIZADA: Toggle rápido de relé Master usando ARRAY
 * 
 * Estrutura: relay_master (1 linha por device, arrays)
 * 
 * Toggle usando array:
 * UPDATE relay_master
 * SET relay_states[2] = true
 * WHERE device_id = 'XXX';
 * 
 * @example
 * POST /api/relay-master/toggle-array
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

    // ✅ Buscar array atual
    const { data: current, error: fetchError } = await supabase
      .from('relay_master')
      .select('relay_states, relay_has_timers, relay_remaining_times')
      .eq('device_id', device_id)
      .single();

    if (fetchError || !current) {
      // Se não existe, criar com arrays padrão
      const defaultStates = Array(16).fill(false);
      const defaultTimers = Array(16).fill(false);
      const defaultTimes = Array(16).fill(0);

      defaultStates[relay_number] = state;
      defaultTimers[relay_number] = has_timer;
      defaultTimes[relay_number] = remaining_time;

      const { data, error } = await supabase
        .from('relay_master')
        .insert({
          device_id,
          relay_states: defaultStates,
          relay_has_timers: defaultTimers,
          relay_remaining_times: defaultTimes,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar relé master:', error);
        return NextResponse.json(
          { error: 'Erro ao criar relé master', details: error.message },
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
    }

    // ✅ Atualizar array (modificar elemento específico)
    const newStates = [...(current.relay_states || Array(16).fill(false))];
    const newTimers = [...(current.relay_has_timers || Array(16).fill(false))];
    const newTimes = [...(current.relay_remaining_times || Array(16).fill(0))];

    newStates[relay_number] = state;
    newTimers[relay_number] = has_timer;
    newTimes[relay_number] = remaining_time;

    // ✅ UPDATE otimizado: 1 linha, arrays atualizados
    const { data, error } = await supabase
      .from('relay_master')
      .update({
        relay_states: newStates,
        relay_has_timers: newTimers,
        relay_remaining_times: newTimes,
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
    console.error('Erro em POST /api/relay-master/toggle-array:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

