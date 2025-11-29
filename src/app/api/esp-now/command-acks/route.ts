import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para buscar ACKs de comandos ESP-NOW
 * 
 * Padrão Indústria: Rastreamento de Command ID → ACK
 * 
 * Query params:
 * - master_device_id: ID do Master
 * - command_id: ID do comando específico (opcional)
 * - limit: Limite de registros (padrão: 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const masterDeviceId = searchParams.get('master_device_id');
    const commandId = searchParams.get('command_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!masterDeviceId) {
      return NextResponse.json(
        { error: 'master_device_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar comandos que foram completados ou falharam
    // (ACKs são representados por status 'completed' ou 'failed')
    let query = supabase
      .from('relay_commands')
      .select('*')
      .eq('device_id', masterDeviceId)
      .in('status', ['completed', 'failed', 'sent'])
      .order('updated_at', { ascending: false })
      .limit(limit);

    // Se command_id foi fornecido, filtrar por ele
    if (commandId) {
      query = query.eq('id', parseInt(commandId, 10));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar ACKs:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar ACKs', details: error.message },
        { status: 500 }
      );
    }

    // Converter para formato de ACK
    const acks = (data || []).map(cmd => ({
      command_id: cmd.id,
      device_id: cmd.device_id,
      target_device_id: cmd.target_device_id,
      relay_number: cmd.relay_number,
      action: cmd.action,
      success: cmd.status === 'completed',
      status: cmd.status,
      created_at: cmd.created_at,
      updated_at: cmd.updated_at,
      // Nota: current_state não está disponível diretamente
      // Seria necessário buscar do Master ou do Slave
    }));

    return NextResponse.json({
      success: true,
      acks,
      count: acks.length,
    });
  } catch (error) {
    console.error('Error in command-acks API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

