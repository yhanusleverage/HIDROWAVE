import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isSupabaseMissingTableError, normalizeEmail } from '@/lib/db-schema';

const TASK_TYPES = [
  'dosagem',
  'manutencao',
  'monitoramento',
  'colheita',
  'plantio',
] as const;

type TaskType = (typeof TASK_TYPES)[number];
type PriorityLabel = 'low' | 'medium' | 'high';

function normalizeTaskType(value: unknown): TaskType {
  const s = String(value ?? 'monitoramento');
  return TASK_TYPES.includes(s as TaskType) ? (s as TaskType) : 'monitoramento';
}

function normalizePriorityLabel(value: unknown): PriorityLabel {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  if (typeof value === 'number') {
    if (value <= 3) return 'low';
    if (value <= 7) return 'medium';
    return 'high';
  }
  return 'medium';
}

function priorityToLegacyNumber(label: PriorityLabel): number {
  if (label === 'low') return 2;
  if (label === 'high') return 9;
  return 5;
}

function missingTableResponse() {
  return NextResponse.json(
    {
      error: 'Calendário de tarefas não disponível (tabela crop_tasks ausente)',
      table_available: false,
    },
    { status: 503 }
  );
}

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

    const email = normalizeEmail(userEmail);

    let query = supabase
      .from('crop_tasks')
      .select('*')
      .eq('device_id', deviceId.trim())
      .eq('user_email', email)
      .order('task_date', { ascending: true })
      .order('task_time', { ascending: true });

    if (startDate) {
      query = query.gte('task_date', startDate);
    }
    if (endDate) {
      query = query.lte('task_date', endDate);
    }
    if (completed != null && completed !== '') {
      query = query.eq('completed', completed === 'true');
    }

    const { data, error } = await query;

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return NextResponse.json({ tasks: [], table_available: false });
      }
      console.error('Erro ao buscar tarefas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar tarefas', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data || [], table_available: true });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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

    if (!device_id || !user_email || !title || !task_date) {
      return NextResponse.json(
        { error: 'device_id, user_email, title e task_date são obrigatórios' },
        { status: 400 }
      );
    }

    const deviceId = String(device_id).trim();
    const email = normalizeEmail(String(user_email));
    const taskType = normalizeTaskType(task_type);
    const priorityLabel = normalizePriorityLabel(priority);
    const dateStr = String(task_date).slice(0, 10);

    const baseRow = {
      device_id: deviceId,
      user_email: email,
      title: String(title).trim(),
      description: description != null && String(description).trim() !== '' ? String(description) : null,
      task_type: taskType,
      priority: priorityLabel,
      task_date: dateStr,
      task_time: task_time ? String(task_time).slice(0, 8) : null,
      completed: false,
    };

    let { data, error } = await supabase
      .from('crop_tasks')
      .insert(baseRow)
      .select()
      .single();

    // Schema legado: priority INTEGER
    if (error && /priority/i.test(error.message ?? '')) {
      const legacyRow = {
        ...baseRow,
        priority: priorityToLegacyNumber(priorityLabel),
      };
      ({ data, error } = await supabase
        .from('crop_tasks')
        .insert(legacyRow)
        .select()
        .single());
    }

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return missingTableResponse();
      }
      console.error('Erro ao criar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao criar tarefa', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data, table_available: true }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { ...updates };

    if (updates.task_type != null) {
      patch.task_type = normalizeTaskType(updates.task_type);
    }
    if (updates.priority != null) {
      patch.priority = normalizePriorityLabel(updates.priority);
    }

    if (updates.completed === true && !updates.completed_at) {
      patch.completed_at = new Date().toISOString();
    }

    let { data, error } = await supabase
      .from('crop_tasks')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error && patch.priority != null && /priority/i.test(error.message ?? '')) {
      const legacyPatch = {
        ...patch,
        priority: priorityToLegacyNumber(normalizePriorityLabel(updates.priority)),
      };
      ({ data, error } = await supabase
        .from('crop_tasks')
        .update(legacyPatch)
        .eq('id', id)
        .select()
        .single());
    }

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return missingTableResponse();
      }
      console.error('Erro ao atualizar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar tarefa', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { error } = await supabase.from('crop_tasks').delete().eq('id', id);

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return missingTableResponse();
      }
      console.error('Erro ao deletar tarefa:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar tarefa', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
