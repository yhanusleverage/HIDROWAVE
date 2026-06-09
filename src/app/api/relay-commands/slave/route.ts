import { NextResponse } from 'next/server';
import { createSlaveCommandDirect } from '@/lib/automation';

/**
 * API para criar comandos Slave (relés de dispositivos ESP-NOW Slave)
 * 
 * Esta API cria comandos na tabela relay_commands_slave com status "pending".
 * O ESP32 Master busca esses comandos usando a função RPC get_and_lock_slave_commands().
 * 
 * Campos importantes:
 * - relay_numbers: ARRAY de números de relés (0-7 para slaves)
 * - actions: ARRAY de ações ('on' ou 'off')
 * - duration_seconds: ARRAY de durações em segundos
 * - status: sempre 'pending' ao criar
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,      // ✅ ID do Master ESP32 (obrigatório)
      user_email,            // ✅ Email do usuário (obrigatório)
      master_mac_address,    // ✅ MAC address do Master (obrigatório)
      slave_device_id,       // ✅ ID do Slave (obrigatório)
      slave_mac_address,     // ✅ MAC address do Slave (obrigatório)
      relay_numbers,         // ✅ ARRAY de números de relés (obrigatório)
      actions,               // ✅ ARRAY de ações (obrigatório)
      duration_seconds,      // ✅ ARRAY de durações (opcional, default: [0])
      command_type = 'manual', // Tipo: 'manual' | 'rule' | 'peristaltic'
      priority = 50,         // Prioridade 0-100 (default: 50)
      expires_at,            // ✅ TTL (opcional)
      triggered_by = 'manual', // 'manual' | 'automation' | 'rule' | 'peristaltic'
      rule_id,               // ID da regra (se triggered_by = 'rule')
      rule_name,             // Nome da regra (se triggered_by = 'rule')
    } = body;

    // ✅ Validações obrigatórias
    if (!master_device_id || !slave_device_id || !slave_mac_address) {
      return NextResponse.json(
        { error: 'master_device_id, slave_device_id e slave_mac_address são obrigatórios' },
        { status: 400 }
      );
    }

    // ✅ Validar user_email e master_mac_address (obrigatórios para inserção)
    if (!user_email) {
      return NextResponse.json(
        { error: 'user_email é obrigatório. O Master precisa ter um user_email registrado em device_status.' },
        { status: 400 }
      );
    }

    if (!master_mac_address) {
      return NextResponse.json(
        { error: 'master_mac_address é obrigatório. O Master precisa ter um mac_address registrado em device_status.' },
        { status: 400 }
      );
    }

    // ✅ Validar relay_numbers (deve ser array não vazio)
    if (!Array.isArray(relay_numbers) || relay_numbers.length === 0) {
      return NextResponse.json(
        { error: 'relay_numbers deve ser um array não vazio' },
        { status: 400 }
      );
    }

    // ✅ Validar actions (deve ser array com mesmo tamanho de relay_numbers)
    if (!Array.isArray(actions) || actions.length !== relay_numbers.length) {
      return NextResponse.json(
        { error: 'actions deve ser um array com mesmo tamanho de relay_numbers' },
        { status: 400 }
      );
    }

    // ✅ Validar cada action ('on' ou 'off')
    for (const action of actions) {
      if (action !== 'on' && action !== 'off') {
        return NextResponse.json(
          { error: `action inválida: "${action}". Deve ser 'on' ou 'off'` },
          { status: 400 }
        );
      }
    }

    // ✅ Validar relay_numbers (0-7 para slaves)
    for (const relayNum of relay_numbers) {
      if (typeof relayNum !== 'number' || relayNum < 0 || relayNum > 7) {
        return NextResponse.json(
          { error: `relay_number inválido: ${relayNum}. Deve ser 0-7 para slaves` },
          { status: 400 }
        );
      }
    }

    // ✅ Validar priority (0-100)
    if (typeof priority !== 'number' || priority < 0 || priority > 100) {
      return NextResponse.json(
        { error: 'priority deve ser um número entre 0 e 100' },
        { status: 400 }
      );
    }

    // ✅ Validar command_type
    if (!['manual', 'rule', 'peristaltic'].includes(command_type)) {
      return NextResponse.json(
        { error: `command_type inválido: "${command_type}". Deve ser 'manual', 'rule' ou 'peristaltic'` },
        { status: 400 }
      );
    }

    // ✅ Preparar duration_seconds (default: array de zeros)
    const durations = duration_seconds || relay_numbers.map(() => 0);

    // ✅ Validar duration_seconds (deve ser array com mesmo tamanho)
    if (!Array.isArray(durations) || durations.length !== relay_numbers.length) {
      return NextResponse.json(
        { error: 'duration_seconds deve ser um array com mesmo tamanho de relay_numbers' },
        { status: 400 }
      );
    }

    // ✅ Validar cada duration (0-86400 segundos = 24 horas)
    for (const duration of durations) {
      if (typeof duration !== 'number' || duration < 0 || duration > 86400) {
        return NextResponse.json(
          { error: `duration_seconds inválido: ${duration}. Deve ser 0-86400` },
          { status: 400 }
        );
      }
    }

    // ⚡ OPTIMIZACIÓN: Usar función compartida (más rápido, sin duplicación)
    const result = await createSlaveCommandDirect({
      master_device_id,
      user_email,
      master_mac_address,
      slave_device_id,
      slave_mac_address,
      relay_numbers,
      actions,
      duration_seconds: durations,
      command_type,
      priority,
      expires_at: expires_at || null,
      triggered_by,
      rule_id: rule_id || null,
      rule_name: rule_name || null,
    });

    if (!result || !result.success) {
      return NextResponse.json(
        { 
          error: result?.error || 'Erro ao criar comando',
        },
        { status: result?.error?.includes('não existe') ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comando criado com sucesso',
      command: result.command,
    });
  } catch (error) {
    console.error('❌ Erro inesperado ao criar comando slave:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar comando' },
      { status: 500 }
    );
  }
}

