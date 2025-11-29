import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API para registrar dispositivos no Supabase
 * 
 * Usado pelo ESP32 Master para registrar:
 * 1. O próprio dispositivo Master
 * 2. Dispositivos ESP-NOW Slaves descobertos
 * 
 * Parâmetros:
 * - device_id: ID único do dispositivo (geralmente MAC address ou nome único)
 * - mac_address: MAC address do dispositivo
 * - user_email: Email do usuário (obrigatório)
 * - device_name: Nome do dispositivo (opcional)
 * - device_type: Tipo do dispositivo ('ESP32_HYDROPONIC' ou 'ESP32_SLAVE')
 * - location: Localização do dispositivo (opcional)
 * - ip_address: IP address (opcional, se conectado via WiFi)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      device_id,
      mac_address,
      user_email,
      device_name,
      device_type = 'ESP32_HYDROPONIC',
      location,
      ip_address,
    } = body;

    // Validações
    if (!device_id || !mac_address || !user_email) {
      return NextResponse.json(
        { error: 'device_id, mac_address e user_email são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar device_type
    if (device_type !== 'ESP32_HYDROPONIC' && device_type !== 'ESP32_SLAVE') {
      return NextResponse.json(
        { error: "device_type deve ser 'ESP32_HYDROPONIC' ou 'ESP32_SLAVE'" },
        { status: 400 }
      );
    }

    // Usar função RPC do Supabase (register_device_with_email)
    const { data, error } = await supabase.rpc('register_device_with_email', {
      p_device_id: device_id,
      p_mac_address: mac_address,
      p_user_email: user_email,
      p_device_name: device_name || (device_type === 'ESP32_SLAVE' ? `ESP-NOW Slave ${mac_address}` : 'ESP32 Hidropônico'),
      p_location: location,
      p_ip_address: ip_address,
    });

    if (error) {
      console.error('Erro ao registrar dispositivo:', error);
      return NextResponse.json(
        { error: error.message || 'Erro ao registrar dispositivo' },
        { status: 500 }
      );
    }

    // Atualizar device_type se necessário (a função RPC pode não fazer isso)
    if (device_type === 'ESP32_SLAVE') {
      const { error: updateError } = await supabase
        .from('device_status')
        .update({ device_type: 'ESP32_SLAVE' })
        .eq('device_id', device_id);

      if (updateError) {
        console.error('Erro ao atualizar device_type:', updateError);
        // Não falhar, apenas logar o erro
      }
    }

    return NextResponse.json({
      success: true,
      message: `Dispositivo ${device_type === 'ESP32_SLAVE' ? 'ESP-NOW Slave' : 'Master'} registrado com sucesso`,
      device_id,
      device_type,
    });
  } catch (error) {
    console.error('Erro na API de registro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

