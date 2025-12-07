import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para reiniciar dispositivo ESP32
 * 
 * Usa função RPC do Supabase para incrementar reboot_count de forma segura.
 * O ESP32 verifica esse campo periodicamente e reinicia quando necessário.
 * 
 * @param device_id - ID do dispositivo a reiniciar
 * @param user_email - Email do usuário (para validação)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { device_id, user_email } = body;

    if (!device_id) {
      return NextResponse.json(
        { error: 'device_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!user_email) {
      return NextResponse.json(
        { error: 'user_email é obrigatório' },
        { status: 400 }
      );
    }

    // ✅ Usar função RPC do Supabase (increment_reboot_count)
    const { data, error } = await supabase.rpc('increment_reboot_count', {
      p_device_id: device_id,
      p_user_email: user_email,
    });

    if (error) {
      console.error('Erro ao chamar RPC increment_reboot_count:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao atualizar contador de reinícios' },
        { status: 500 }
      );
    }

    // ✅ A função RPC retorna JSONB com success/error
    if (!data || !data.success) {
      const errorMessage = data?.error || 'Erro desconhecido ao reiniciar dispositivo';
      const statusCode = errorMessage.includes('não encontrado') ? 404 : 400;
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // ✅ Sucesso - retornar dados da RPC
    return NextResponse.json({
      success: true,
      message: data.message || 'Contador de reinícios atualizado. O dispositivo será reiniciado na próxima verificação.',
      reboot_count: data.reboot_count,
      previous_count: data.previous_count,
    });
  } catch (error: any) {
    console.error('Erro na API de reboot:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

