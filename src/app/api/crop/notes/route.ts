import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    let query = supabase
      .from('crop_day_notes')
      .select('*')
      .eq('device_id', deviceId)
      .eq('user_email', userEmail)
      .order('note_date', { ascending: false });

    // Filtros opcionais
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
      console.error('Erro ao buscar anotações:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar anotações', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: data || [] });
  } catch (error) {
    console.error('Erro na API de anotações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Criar ou atualizar anotação (upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      user_email,
      note_date,
      notes,
    } = body;

    // Validações
    if (!device_id || !user_email || !note_date) {
      return NextResponse.json(
        { error: 'device_id, user_email e note_date são obrigatórios' },
        { status: 400 }
      );
    }

    // Usar upsert (insert ou update) baseado na constraint UNIQUE
    const { data, error } = await supabase
      .from('crop_day_notes')
      .upsert({
        device_id,
        user_email,
        note_date,
        notes: notes || null,
      }, {
        onConflict: 'device_id,user_email,note_date',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar anotação:', error);
      return NextResponse.json(
        { error: 'Erro ao salvar anotação', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error('Erro na API de anotações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
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
        .eq('device_id', deviceId!)
        .eq('user_email', userEmail!)
        .eq('note_date', noteDate!);
    }

    const { error } = await query;

    if (error) {
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
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
