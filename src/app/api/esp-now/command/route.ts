import { NextResponse } from 'next/server';
import { createRelayCommand } from '@/lib/automation';
import { supabase } from '@/lib/supabase';

/**
 * API para enviar comandos ESP-NOW para slaves
 * 
 * Fluxo:
 * 1. Cria registro em relay_commands (status: 'pending')
 * 2. ESP32 Master busca comandos pendentes
 * 3. ESP32 Master envia via ESP-NOW usando MasterSlaveManager
 * 4. ESP32 Master atualiza status para 'sent' e depois 'completed'
 * 
 * Divisão de relés:
 * - HydroControl (local): device_id = master_device_id, relay_number 0-15
 * - ESP-NOW Slave: device_id = master_device_id, target_device_id = slave_mac
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      master_device_id,    // ID do ESP32 Master
      slave_mac_address,   // MAC do slave (null se for relé local)
      slave_name,          // ✅ Nome do slave (device_name) - usado como target_device_id
      relay_number,        // 0-15 (local) ou 0-7 (slave)
      action,              // 'on' ou 'off'
      duration_seconds,    // Duração em segundos (0 = permanente)
      triggered_by = 'manual', // 'manual' ou 'automation' ou 'peristaltic'
      rule_id,             // ID da regra se for automação
      rule_name,           // Nome da regra
      command_type,        // ✅ FORK: 'manual' | 'rule' | 'peristaltic'
      priority,            // ✅ Prioridade (0-100) - opcional
    } = body;

    // Validações
    if (!master_device_id) {
      return NextResponse.json(
        { error: 'master_device_id é obrigatório' },
        { status: 400 }
      );
    }

    if (typeof relay_number !== 'number' || relay_number < 0 || relay_number > 15) {
      return NextResponse.json(
        { error: 'relay_number inválido (0-15)' },
        { status: 400 }
      );
    }

    if (action !== 'on' && action !== 'off') {
      return NextResponse.json(
        { error: "action deve ser 'on' ou 'off'" },
        { status: 400 }
      );
    }

    if (duration_seconds !== undefined && (duration_seconds < 0 || duration_seconds > 86400)) {
      return NextResponse.json(
        { error: 'duration_seconds inválido (0-86400)' },
        { status: 400 }
      );
    }

    // Determinar device_id para relay_commands
    // Se for slave, usamos o MAC como identificador único
    // Se for local, usamos o master_device_id
    const device_id_for_command = slave_mac_address || master_device_id;

    // ✅ FORK: Determinar command_type se não fornecido
    let finalCommandType: 'manual' | 'rule' | 'peristaltic' = command_type || 'manual';
    if (!command_type) {
      // Fallback: Determinar baseado em triggered_by
      if (triggered_by === 'automation' || triggered_by === 'rule') {
        finalCommandType = 'rule';
      } else if (triggered_by === 'peristaltic') {
        finalCommandType = 'peristaltic';
      } else {
        finalCommandType = 'manual';
      }
    }
    
    // ✅ PRIORIDADE: Se não fornecida, usar defaults inteligentes baseados em command_type
    // Se for rule, buscar priority da regra (se rule_id fornecido)
    let finalPriority: number | undefined = priority;
    
    if (finalPriority === undefined && finalCommandType === 'rule' && rule_id) {
      // ✅ Buscar priority da regra em decision_rules
      const { data: ruleData } = await supabase
        .from('decision_rules')
        .select('priority')
        .eq('rule_id', rule_id)
        .eq('device_id', master_device_id)
        .single();
      
      if (ruleData?.priority !== undefined) {
        finalPriority = ruleData.priority;
        console.log(`📊 Priority da regra "${rule_id}": ${finalPriority}`);
      }
    }
    
    // ✅ Se ainda não tiver priority, usar defaults por command_type
    if (finalPriority === undefined) {
      switch (finalCommandType) {
        case 'peristaltic':
          finalPriority = 80; // Alta prioridade (dosagem)
          break;
        case 'rule':
          finalPriority = 50; // Média prioridade (regras)
          break;
        case 'manual':
        default:
          finalPriority = 10; // Baixa prioridade (manual)
          break;
      }
      console.log(`📊 Priority default para ${finalCommandType}: ${finalPriority}`);
    }
    
    // ✅ Criar comando no Supabase com target_device_id para slaves
    // device_id = master_device_id (sempre)
    // target_device_id = slave_name (nome do slave) se for comando para slave
    const commandData: any = {
      device_id: master_device_id, // Sempre usar master_device_id como device_id
      relay_number: relay_number,
      action: action as 'on' | 'off',
      duration_seconds: duration_seconds || undefined,
      status: 'pending',
      created_by: 'web_interface',
      triggered_by: triggered_by as 'manual' | 'automation' | 'peristaltic',
      command_type: finalCommandType, // ✅ FORK: Tipo de comando
      priority: finalPriority, // ✅ Prioridade (definida ou default)
      rule_id: rule_id || undefined,
      rule_name: rule_name || undefined,
    };

    // ✅ Se for comando para slave, adicionar target_device_id (nome do slave) e slave_mac_address
    if (slave_mac_address) {
      commandData.slave_mac_address = slave_mac_address; // ✅ MAC do slave
      if (slave_name) {
        commandData.target_device_id = slave_name; // Nome do slave (ex: "ESP-NOW-SLAVE")
      }
    }

    // ✅ OBTER master_mac_address e user_email do device_status
    const { data: deviceData, error: deviceError } = await supabase
      .from('device_status')
      .select('mac_address, user_email')
      .eq('device_id', master_device_id)
      .single();

    if (deviceError || !deviceData) {
      console.error('❌ Erro ao buscar device_status:', deviceError);
      return NextResponse.json(
        { 
          error: `device_id "${master_device_id}" não existe em device_status`,
          details: 'O Master precisa estar registrado na tabela device_status antes de criar comandos.'
        },
        { status: 400 }
      );
    }

    // ✅ Validar que mac_address e user_email existem
    if (!deviceData.mac_address) {
      return NextResponse.json(
        { 
          error: `Master "${master_device_id}" não tem mac_address registrado`,
          details: 'O Master precisa ter um mac_address válido em device_status.'
        },
        { status: 400 }
      );
    }

    if (!deviceData.user_email) {
      return NextResponse.json(
        { 
          error: `Master "${master_device_id}" não tem user_email registrado`,
          details: 'O Master precisa ter um user_email válido em device_status.'
        },
        { status: 400 }
      );
    }

    // ✅ Adicionar master_mac_address e user_email ao commandData
    commandData.master_mac_address = deviceData.mac_address;
    commandData.user_email = deviceData.user_email;

    // ✅ Se for slave, adicionar slave_device_id
    if (slave_mac_address) {
      commandData.slave_device_id = `ESP32_SLAVE_${slave_mac_address.replace(/:/g, '_')}`;
    }

    const apiStartTime = Date.now();
    const env = process.env.NODE_ENV || 'development';
    const isVercel = !!process.env.VERCEL;
    
    console.log(`🔍 [DEBUG-API-ESP-NOW] Recebendo comando`);
    console.log(`   Ambiente: ${env} | Vercel: ${isVercel ? 'SIM' : 'NÃO'}`);
    console.log(`   Master: ${master_device_id} | Slave: ${slave_mac_address || 'N/A'} | Relay: ${relay_number} | Action: ${action}`);
    console.log(`   Master MAC: ${deviceData.mac_address} | User: ${deviceData.user_email}`);

    const command = await createRelayCommand(commandData);
    
    const apiTime = Date.now() - apiStartTime;

    if (!command) {
      console.error(`❌ [DEBUG-API-ESP-NOW] Erro ao criar comando: createRelayCommand retornou null`);
      console.error(`   ⏱️ Tempo total: ${apiTime}ms`);
      console.error(`   Dados do comando:`, JSON.stringify(commandData, null, 2));
      
      // ✅ Verificar se device_id existe
      const { data: deviceCheck } = await supabase
        .from('device_status')
        .select('device_id')
        .eq('device_id', master_device_id)
        .single();
      
      if (!deviceCheck) {
        return NextResponse.json(
          { 
            error: `device_id "${master_device_id}" não existe em device_status. Verifique se o Master está registrado.`,
            details: 'O Master precisa estar registrado na tabela device_status antes de criar comandos.'
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Erro ao criar comando de relé. Verifique os logs do servidor para mais detalhes.',
          command_data: commandData
        },
        { status: 500 }
      );
    }

    // Em uma implementação real, aqui você:
    // 1. Enviaria o comando para o ESP32 Master via HTTP/WebSocket
    // 2. ESP32 Master processaria e enviaria via ESP-NOW
    // 3. ESP32 Master atualizaria status do comando

    console.log(`✅ [DEBUG-API-ESP-NOW] Comando criado com sucesso!`);
    console.log(`   ID: ${command.id} | ${action} relé ${relay_number} ${slave_mac_address ? `no slave ${slave_mac_address}` : 'local'}`);
    console.log(`   ⏱️ Tempo total da API: ${apiTime}ms`);

    return NextResponse.json({
      success: true,
      message: `Comando ${action} criado com sucesso`,
      command_id: command.id,
      command: {
        id: command.id,
        device_id: device_id_for_command,
        relay_number,
        action,
        duration_seconds,
        status: 'pending',
        is_local: !slave_mac_address,
        is_slave: !!slave_mac_address,
        slave_mac: slave_mac_address || null,
      },
    });
  } catch (error) {
    console.error('Error in ESP-NOW command API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

