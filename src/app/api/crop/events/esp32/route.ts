import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API ESP32 para interagir com crop_events (sistema RPC-like)
 * 
 * GET: Buscar eventos pendentes (chama função RPC get_and_lock_crop_events)
 * PATCH: Confirmar execução de evento (processing → synced/failed)
 * 
 * Fluxo:
 * 1. ESP32 → GET → Busca eventos pendentes (atomic swap: pending → processing)
 * 2. ESP32 → Executa automated_actions
 * 3. ESP32 → PATCH → Confirma execução (processing → synced/failed)
 */

// GET - Buscar eventos pendentes (via RPC)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const timeoutSeconds = parseInt(searchParams.get('timeout_seconds') || '60', 10);

    if (!deviceId) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }

    // ✅ Chamar função RPC get_and_lock_crop_events()
    // Esta função faz atomic swap: pending → processing
    const { data, error } = await supabase.rpc('get_and_lock_crop_events', {
      p_device_id: deviceId,
      p_limit: limit,
      p_timeout_seconds: timeoutSeconds,
    });

    if (error) {
      console.error('❌ Erro ao buscar eventos via RPC:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar eventos', details: error.message },
        { status: 500 }
      );
    }

    // ✅ Parsear automated_actions (JSONB) se necessário
    const events = (data || []).map((event: any) => {
      if (event.automated_actions && typeof event.automated_actions === 'string') {
        try {
          event.automated_actions = JSON.parse(event.automated_actions);
        } catch (e) {
          console.warn('⚠️ Erro ao parsear automated_actions:', e);
          event.automated_actions = [];
        }
      }
      return event;
    });

    return NextResponse.json({
      success: true,
      events: events,
      count: events.length,
    });
  } catch (error) {
    console.error('❌ Erro na API ESP32 de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Confirmar execução de evento
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const {
      id,                    // ✅ ID do evento (obrigatório)
      sync_status,           // ✅ 'synced' ou 'failed' (obrigatório)
      error_message,         // Mensagem de erro (se sync_status = 'failed')
      execution_details,     // Detalhes da execução (opcional, JSONB)
    } = body;

    if (!id || !sync_status) {
      return NextResponse.json(
        { error: 'id e sync_status são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['synced', 'failed'].includes(sync_status)) {
      return NextResponse.json(
        { error: 'sync_status deve ser "synced" ou "failed"' },
        { status: 400 }
      );
    }

    // ✅ Verificar se evento está em "processing" (atomic check)
    const { data: currentEvent, error: fetchError } = await supabase
      .from('crop_events')
      .select('id, sync_status')
      .eq('id', id)
      .single();

    if (fetchError || !currentEvent) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      );
    }

    if (currentEvent.sync_status !== 'processing') {
      return NextResponse.json(
        { 
          error: `Evento não está em status "processing". Status atual: ${currentEvent.sync_status}`,
          current_status: currentEvent.sync_status,
        },
        { status: 400 }
      );
    }

    // ✅ Preparar atualização
    const updates: any = {
      sync_status,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    // Se marcou como "synced", também marca como "completed"
    if (sync_status === 'synced') {
      updates.completed = true;
      updates.completed_at = new Date().toISOString();
    }

    // Adicionar error_message se houver
    if (error_message) {
      updates.error_message = error_message;
    }

    // Adicionar execution_details se fornecido
    if (execution_details) {
      updates.execution_details = typeof execution_details === 'string' 
        ? execution_details 
        : JSON.stringify(execution_details);
    }

    // ✅ Atualizar evento (atomic: só atualiza se ainda está "processing")
    const { data, error } = await supabase
      .from('crop_events')
      .update(updates)
      .eq('id', id)
      .eq('sync_status', 'processing')  // ✅ CRÍTICO: Double-check atômico
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar evento:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar evento', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { 
          error: 'Evento não foi atualizado. Pode ter sido atualizado por outro processo.',
          current_status: currentEvent.sync_status,
        },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json({
      success: true,
      message: `Evento ${id} marcado como ${sync_status}`,
      event: data,
    });
  } catch (error) {
    console.error('❌ Erro na API ESP32 de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
