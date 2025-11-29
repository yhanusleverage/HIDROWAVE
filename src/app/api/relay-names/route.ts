import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para buscar nomes personalizados dos relés
 * 
 * ✅ CORRIGIDO: Agora roda no servidor (não no cliente)
 * Isso garante que a chave de API seja enviada corretamente
 * 
 * Query params:
 * - device_ids: Array de device_ids separados por vírgula
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceIdsParam = searchParams.get('device_ids');
    
    if (!deviceIdsParam) {
      console.warn('⚠️ /api/relay-names: device_ids não fornecido');
      return NextResponse.json(
        { error: 'device_ids é obrigatório', relay_names: {} },
        { status: 400 }
      );
    }
    
    // Converter string separada por vírgula em array
    const deviceIds = deviceIdsParam.split(',').filter(id => id.trim().length > 0);
    
    if (deviceIds.length === 0) {
      console.warn('⚠️ /api/relay-names: Nenhum device_id válido fornecido');
      return NextResponse.json({ relay_names: {} });
    }
    
    console.log('🔍 /api/relay-names: Buscando nomes para devices:', deviceIds);
    
    // Buscar nomes dos relés do Supabase
    const { data, error } = await supabase
      .from('relay_names')
      .select('device_id, relay_number, relay_name')
      .in('device_id', deviceIds);
    
    if (error) {
      console.error('❌ Erro ao buscar nomes de relés do Supabase:', error);
      console.error('   Código:', error.code);
      console.error('   Mensagem:', error.message);
      console.error('   Detalhes:', error.details);
      
      // Se erro for "tabela não existe", retornar vazio mas logar
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('⚠️ Tabela relay_names não existe! Execute FASE1_VERIFICAR_RELAY_NAMES.sql');
        return NextResponse.json(
          { 
            error: 'Tabela relay_names não existe. Execute script de verificação.',
            relay_names: {} 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Erro ao buscar nomes de relés', 
          error_details: error.message,
          relay_names: {} 
        },
        { status: 500 }
      );
    }
    
    console.log(`✅ /api/relay-names: ${data?.length || 0} nomes encontrados`);
    
    // Organizar em objeto: { device_id: { relay_number: relay_name } }
    const relayNamesMap: Record<string, Record<number, string>> = {};
    
    (data || []).forEach((row) => {
      if (!relayNamesMap[row.device_id]) {
        relayNamesMap[row.device_id] = {};
      }
      relayNamesMap[row.device_id][row.relay_number] = row.relay_name;
    });
    
    return NextResponse.json({ relay_names: relayNamesMap });
  } catch (error) {
    console.error('❌ Erro em GET /api/relay-names:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        error_details: error instanceof Error ? error.message : String(error),
        relay_names: {} 
      },
      { status: 500 }
    );
  }
}

