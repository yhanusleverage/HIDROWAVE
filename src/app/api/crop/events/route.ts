import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para gerenciar eventos programados do calendário (crop_events)
 * 
 * GET: Buscar eventos
 * POST: Criar novo evento
 * PATCH: Atualizar evento
 * DELETE: Deletar evento
 */

// GET - Buscar eventos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const userEmail = searchParams.get('user_email');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const enabled = searchParams.get('enabled');
    const isRecurring = searchParams.get('is_recurring');

    if (!deviceId || !userEmail) {
      return NextResponse.json(
        { error: 'device_id e user_email são obrigatórios' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('crop_events')
      .select('*')
      .eq('device_id', deviceId)
      .eq('user_email', userEmail)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true });

    // Filtros opcionais
    if (startDate) {
      query = query.gte('start_date', startDate);
    }
    if (endDate) {
      query = query.lte('start_date', endDate);
    }
    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true');
    }
    if (isRecurring !== null) {
      query = query.eq('is_recurring', isRecurring === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar eventos', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: data || [] });
  } catch (error) {
    console.error('Erro na API de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Criar novo evento
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      user_email,
      title,
      description,
      event_type,
      start_date,
      start_time,
      end_date,
      end_time,
      is_recurring,
      recurrence_pattern,
      recurrence_interval,
      recurrence_end_date,
      automated_actions,
      enabled,
    } = body;

    // Validações
    if (!device_id || !user_email || !title || !start_date) {
      return NextResponse.json(
        { error: 'device_id, user_email, title e start_date são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio', 'fertilizacao', 'poda', 'transplante'].includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type inválido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('crop_events')
      .insert({
        device_id,
        user_email,
        title,
        description: description || null,
        event_type,
        start_date,
        start_time: start_time || null,
        end_date: end_date || null,
        end_time: end_time || null,
        is_recurring: is_recurring || false,
        recurrence_pattern: recurrence_pattern || null,
        recurrence_interval: recurrence_interval || 1,
        recurrence_end_date: recurrence_end_date || null,
        automated_actions: automated_actions ? JSON.stringify(automated_actions) : '[]',
        enabled: enabled !== undefined ? enabled : true,
        completed: false,
        sync_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar evento:', error);
      return NextResponse.json(
        { error: 'Erro ao criar evento', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar evento
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    // Converter automated_actions para JSON se for array
    if (updates.automated_actions && Array.isArray(updates.automated_actions)) {
      updates.automated_actions = JSON.stringify(updates.automated_actions);
    }

    // Se marcar como completed, adicionar completed_at
    if (updates.completed === true && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    // Atualizar sync_status para pending se houver mudanças
    if (Object.keys(updates).length > 0) {
      updates.sync_status = 'pending';
    }

    const { data, error } = await supabase
      .from('crop_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar evento:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar evento', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ event: data });
  } catch (error) {
    console.error('Erro na API de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar evento
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('crop_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar evento:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar evento', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de eventos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
