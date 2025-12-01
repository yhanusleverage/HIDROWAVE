import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para gerenciar tarefas do calendário de cultivo (crop_tasks)
 * 
 * GET: Buscar tarefas
 * POST: Criar nova tarefa
 * PATCH: Atualizar tarefa
 * DELETE: Deletar tarefa
 */

// GET - Buscar tarefas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const userEmail = searchParams.get('user_email');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const completed = searchParams.get('completed');

    if (!deviceId || !userEmail) {
      return NextResponse.json(
        { error: 'device_id e user_email são obrigatórios' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('crop_tasks')
      .select('*')
      .eq('device_id', deviceId)
      .eq('user_email', userEmail)
      .order('task_date', { ascending: true })
      .order('task_time', { ascending: true });

    // Filtros opcionais
    if (startDate) {
      query = query.gte('task_date', startDate);
    }
    if (endDate) {
      query = query.lte('task_date', endDate);
    }
    if (completed !== null) {
      query = query.eq('completed', completed === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar tarefas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar tarefas', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data || [] });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Criar nova tarefa
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      user_email,
      title,
      description,
      task_type,
      priority,
      task_date,
      task_time,
    } = body;

    // Validações
    if (!device_id || !user_email || !title || !task_date) {
      return NextResponse.json(
        { error: 'device_id, user_email, title e task_date são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['dosagem', 'manutencao', 'monitoramento', 'colheita', 'plantio'].includes(task_type)) {
      return NextResponse.json(
        { error: 'task_type inválido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('crop_tasks')
      .insert({
        device_id,
        user_email,
        title,
        description: description || null,
        task_type,
        priority: priority || 'medium',
        task_date,
        task_time: task_time || null,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao criar tarefa', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar tarefa
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

    // Se marcar como completed, adicionar completed_at
    if (updates.completed === true && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('crop_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar tarefa', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar tarefa
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
      .from('crop_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar tarefa', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
