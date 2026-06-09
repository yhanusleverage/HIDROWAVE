import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para gerenciar alarmes/recordatórios do calendário (crop_alarms)
 * 
 * GET: Buscar alarmes
 * POST: Criar novo alarme
 * PATCH: Atualizar alarme
 * DELETE: Deletar alarme
 */

// GET - Buscar alarmes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const userEmail = searchParams.get('user_email');
    const enabled = searchParams.get('enabled');
    const triggered = searchParams.get('triggered');
    const acknowledged = searchParams.get('acknowledged'); // ✅ Novo filtro
    const upcoming = searchParams.get('upcoming'); // Próximos X dias

    if (!deviceId || !userEmail) {
      return NextResponse.json(
        { error: 'device_id e user_email são obrigatórios' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('crop_alarms')
      .select('*')
      .eq('device_id', deviceId)
      .eq('user_email', userEmail)
      .order('alarm_date', { ascending: true })
      .order('alarm_time', { ascending: true });

    // Filtros opcionais
    if (enabled !== null) {
      query = query.eq('enabled', enabled === 'true');
    }
    if (triggered !== null) {
      query = query.eq('triggered', triggered === 'true');
    }
    if (acknowledged !== null) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }
    if (upcoming) {
      const days = parseInt(upcoming, 10);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);
      query = query
        .gte('alarm_date', new Date().toISOString().split('T')[0])
        .lte('alarm_date', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar alarmes:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar alarmes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alarms: data || [] });
  } catch (error) {
    console.error('Erro na API de alarmes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Criar novo alarme
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      user_email,
      title,
      description,
      alarm_type,
      alarm_date,
      alarm_time,
      enabled,
      repeat_pattern,
      days_before,
      task_id,
    } = body;

    // Validações
    if (!device_id || !user_email || !title || !alarm_date || !alarm_time) {
      return NextResponse.json(
        { error: 'device_id, user_email, title, alarm_date e alarm_time são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['reminder', 'alert', 'notification'].includes(alarm_type || 'reminder')) {
      return NextResponse.json(
        { error: 'alarm_type inválido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('crop_alarms')
      .insert({
        device_id,
        user_email,
        title,
        description: description || null,
        alarm_type: alarm_type || 'reminder',
        alarm_date,
        alarm_time,
        enabled: enabled !== undefined ? enabled : true,
        repeat_pattern: repeat_pattern || null,
        days_before: days_before || 0,
        task_id: task_id || null,
        triggered: false,
        acknowledged: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar alarme:', error);
      return NextResponse.json(
        { error: 'Erro ao criar alarme', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alarm: data }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de alarmes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar alarme
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

    // Se marcar como acknowledged, adicionar acknowledged_at
    if (updates.acknowledged === true && !updates.acknowledged_at) {
      updates.acknowledged_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('crop_alarms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar alarme:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar alarme', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alarm: data });
  } catch (error) {
    console.error('Erro na API de alarmes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar alarme
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
      .from('crop_alarms')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar alarme:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar alarme', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de alarmes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
