import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * ✅ NOVA IMPLEMENTAÇÃO: Usa sistema de comandos atômicos
 * 
 * Em vez de atualizar diretamente relay_slaves, cria um comando na fila
 * que será processado pelo ESP32 Master usando a função RPC atômica.
 * 
 * Fluxo:
 * 1. Cria comando em relay_commands_slave (status: 'pending')
 * 2. ESP32 Master busca comando usando get_and_lock_slave_commands() (ATÔMICO)
 * 3. ESP32 Master envia comando via ESP-NOW para Slave
 * 4. ESP32 Master atualiza relay_slaves quando recebe confirmação
 * 
 * Vantagens:
 * - ✅ Atomicidade garantida (sem race conditions)
 * - ✅ Histórico completo de comandos
 * - ✅ Retry automático se falhar
 * - ✅ Timeout automático para comandos travados
 * 
 * @example
 * POST /api/relay-slaves/toggle
 * {
 *   "device_id": "ESP32_SLAVE_14_33_5C_38_BF_60",
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
      device_id,         // device_id do slave (ex: "ESP32_SLAVE_14_33_5C_38_BF_60")
      relay_number,      // 0-7
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

    if (typeof relay_number !== 'number' || relay_number < 0 || relay_number > 7) {
      return NextResponse.json(
        { error: 'relay_number inválido (0-7)' },
        { status: 400 }
      );
    }

    if (typeof state !== 'boolean') {
      return NextResponse.json(
        { error: 'state deve ser boolean (true/false)' },
        { status: 400 }
      );
    }

    // ✅ OBTER informações do slave (master_device_id, slave_mac_address, user_email)
    const { data: slaveData, error: slaveError } = await supabase
      .from('relay_slaves')
      .select('master_device_id, slave_mac_address, user_email')
      .eq('device_id', device_id)
      .single();

    if (slaveError || !slaveData) {
      console.error('❌ Erro ao buscar slave:', slaveError);
      return NextResponse.json(
        { 
          error: `Slave "${device_id}" não encontrado em relay_slaves`,
          details: 'O slave precisa estar registrado antes de criar comandos.'
        },
        { status: 400 }
      );
    }

    // ✅ OBTER master_mac_address do device_status
    const { data: masterData, error: masterError } = await supabase
      .from('device_status')
      .select('mac_address')
      .eq('device_id', slaveData.master_device_id)
      .single();

    if (masterError || !masterData) {
      console.error('❌ Erro ao buscar master:', masterError);
      return NextResponse.json(
        { 
          error: `Master "${slaveData.master_device_id}" não encontrado em device_status`,
          details: 'O Master precisa estar registrado antes de criar comandos.'
        },
        { status: 400 }
      );
    }

    // ✅ Converter state (boolean) para action (string)
    const action = state ? 'on' : 'off';
    
    // ✅ Calcular duration_seconds baseado em remaining_time
    const duration_seconds = has_timer && remaining_time > 0 ? remaining_time : 0;

    // ✅ CRIAR COMANDO usando a nova API atômica
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/relay-commands/slave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        master_device_id: slaveData.master_device_id,
        user_email: slaveData.user_email,
        master_mac_address: masterData.mac_address,
        slave_device_id: device_id,
        slave_mac_address: slaveData.slave_mac_address,
        relay_numbers: [relay_number],      // ✅ ARRAY
        actions: [action],                 // ✅ ARRAY ('on' ou 'off')
        duration_seconds: [duration_seconds], // ✅ ARRAY
        command_type: 'manual',
        priority: 10,
        expires_at: null,
        triggered_by: 'manual',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      console.error('❌ Erro ao criar comando:', errorData);
      return NextResponse.json(
        { 
          error: 'Erro ao criar comando de relé',
          details: errorData.error || 'Erro desconhecido'
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!result.success || !result.command) {
      console.error('❌ API retornou erro:', result);
      return NextResponse.json(
        { 
          error: 'Erro ao criar comando',
          details: result.error || 'Comando não foi criado'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Comando criado: ${action} relé ${relay_number} do slave ${device_id} (ID: ${result.command.id})`);

    return NextResponse.json({
      success: true,
      message: `Comando para ${action === 'on' ? 'ligar' : 'desligar'} relé ${relay_number} criado com sucesso`,
      device_id,
      relay_number,
      state,
      command_id: result.command.id,
      command: result.command,
      note: 'O comando será processado pelo ESP32 Master usando a função RPC atômica get_and_lock_slave_commands()',
    });
  } catch (error) {
    console.error('❌ Erro inesperado em POST /api/relay-slaves/toggle:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

