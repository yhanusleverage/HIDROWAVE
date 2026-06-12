import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isSupabaseMissingTableError, normalizeEmail } from '@/lib/db-schema';

/**
 * API para gerenciar anotações diárias do calendário (crop_day_notes)
 *
 * GET: Buscar anotações
 * POST: Criar/atualizar anotação
 * DELETE: Deletar anotação
 */

// GET - Buscar anotações
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const userEmail = searchParams.get('user_email');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const noteDate = searchParams.get('note_date');

    if (!deviceId || !userEmail) {
      return NextResponse.json(
        { error: 'device_id e user_email são obrigatórios' },
        { status: 400 }
      );
    }

    const email = normalizeEmail(userEmail);

    let query = supabase
      .from('crop_day_notes')
      .select('*')
      .eq('device_id', deviceId.trim())
      .eq('user_email', email)
      .order('note_date', { ascending: false });

    if (noteDate) {
      query = query.eq('note_date', noteDate);
    } else {
      if (startDate) {
        query = query.gte('note_date', startDate);
      }
      if (endDate) {
        query = query.lte('note_date', endDate);
      }
    }

    const { data, error } = await query;

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        console.warn(
          '⚠️ crop_day_notes ausente — executar scripts/CRIAR_TABELAS_CROP_CALENDAR.sql'
        );
        return NextResponse.json({ notes: [], table_available: false });
      }
      console.error('Erro ao buscar anotações:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar anotações', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: data || [], table_available: true });
  } catch (error) {
    console.error('Erro na API de anotações:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Criar ou atualizar anotação (select → update | insert)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, user_email, note_date, notes } = body;

    if (!device_id || !user_email || !note_date) {
      return NextResponse.json(
        { error: 'device_id, user_email e note_date são obrigatórios' },
        { status: 400 }
      );
    }

    const deviceId = String(device_id).trim();
    const email = normalizeEmail(String(user_email));
    const dateStr = String(note_date).slice(0, 10);
    const notesText = notes != null && String(notes).trim() !== '' ? String(notes) : null;

    const { data: existing, error: selectError } = await supabase
      .from('crop_day_notes')
      .select('id')
      .eq('device_id', deviceId)
      .eq('user_email', email)
      .eq('note_date', dateStr)
      .maybeSingle();

    if (selectError) {
      if (isSupabaseMissingTableError(selectError)) {
        return NextResponse.json(
          {
            error: 'Calendário de anotações não disponível (tabela crop_day_notes ausente)',
            table_available: false,
          },
          { status: 503 }
        );
      }
      console.error('Erro ao buscar anotação existente:', selectError);
      return NextResponse.json(
        { error: 'Erro ao salvar anotação', details: selectError.message },
        { status: 500 }
      );
    }

    let data;
    let error;

    if (existing?.id != null) {
      ({ data, error } = await supabase
        .from('crop_day_notes')
        .update({
          notes: notesText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('crop_day_notes')
        .insert({
          device_id: deviceId,
          user_email: email,
          note_date: dateStr,
          notes: notesText,
        })
        .select()
        .single());
    }

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return NextResponse.json(
          {
            error: 'Calendário de anotações não disponível (tabela crop_day_notes ausente)',
            table_available: false,
          },
          { status: 503 }
        );
      }
      console.error('Erro ao salvar anotação:', error);
      return NextResponse.json(
        { error: 'Erro ao salvar anotação', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ note: data, table_available: true });
  } catch (error) {
    console.error('Erro na API de anotações:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Deletar anotação
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deviceId = searchParams.get('device_id');
    const userEmail = searchParams.get('user_email');
    const noteDate = searchParams.get('note_date');

    if (!id && (!deviceId || !userEmail || !noteDate)) {
      return NextResponse.json(
        { error: 'id OU (device_id, user_email, note_date) são obrigatórios' },
        { status: 400 }
      );
    }

    let query = supabase.from('crop_day_notes').delete();

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query
        .eq('device_id', deviceId!.trim())
        .eq('user_email', normalizeEmail(userEmail!))
        .eq('note_date', noteDate!);
    }

    const { error } = await query;

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return NextResponse.json(
          { error: 'Tabela crop_day_notes ausente', table_available: false },
          { status: 503 }
        );
      }
      console.error('Erro ao deletar anotação:', error);
      return NextResponse.json(
        { error: 'Erro ao deletar anotação', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na API de anotações:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
