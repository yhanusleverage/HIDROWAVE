import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API Proxy para buscar slaves do ESP32 Master
 * 
 * ✅ CORRIGIDO: Agora lê APENAS do Supabase (sem fetch direto a IP privada)
 * Isso permite que o sistema funcione em produção (Vercel) de qualquer lugar do mundo
 * 
 * Query params:
 * - master_device_id: ID do Master (obrigatório)
 * - user_email: Email do usuário (opcional, busca do Master se não fornecido)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const masterDeviceId = searchParams.get('master_device_id');

    if (!masterDeviceId) {
      return NextResponse.json(
        { error: 'master_device_id é obrigatório', slaves: [] },
        { status: 400 }
      );
    }

    // ✅ Buscar user_email do Master se não foi fornecido
    let userEmail = searchParams.get('user_email');
    
    if (!userEmail) {
      const { data: masterData } = await supabase
        .from('device_status')
        .select('user_email')
        .eq('device_id', masterDeviceId)
        .single();
      
      if (masterData?.user_email) {
        userEmail = masterData.user_email;
        console.log(`✅ [API Proxy] User email obtido do Master: ${userEmail}`);
      }
    }

    // ✅ Buscar slaves do Supabase de várias formas:
    // 1. device_type contém "slave", "relaybox", "relay"
    // 2. device_id começa com "ESP32_SLAVE_"
    // 3. device_name contém "SLAVE" ou "RelayBox"
    let query = supabase
      .from('device_status')
      .select('*')
      .or('device_type.ilike.%slave%,device_type.ilike.%relaybox%,device_type.ilike.%relay%,device_id.ilike.ESP32_SLAVE_%,device_name.ilike.%SLAVE%,device_name.ilike.%RelayBox%')
      .order('last_seen', { ascending: false });

    if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    const { data: devices, error } = await query;

    if (error) {
      console.error('❌ [API Proxy] Erro ao buscar slaves do Supabase:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar slaves do Supabase', slaves: [] },
        { status: 500 }
      );
    }

    interface DeviceFromSupabase {
      device_id: string;
      device_name?: string;
      user_email?: string;
      mac_address?: string;
      device_type?: string;
      is_online?: boolean;
      last_seen?: string;
      [key: string]: unknown;
    }
    
    interface RelayState {
      device_id: string;
      relay_number: number;
      state: boolean;
      has_timer: boolean;
      remaining_time: number;
      relay_name?: string;
    }
    
    console.log(`✅ [API Proxy] ${devices?.length || 0} slave(s) encontrado(s) no Supabase`);
    if (devices && devices.length > 0) {
      console.log('   Slaves:', devices.map((d: DeviceFromSupabase) => ({
        device_id: d.device_id,
        device_name: d.device_name,
        user_email: d.user_email,
        mac_address: d.mac_address
      })));
    }

    // ✅ Buscar estados dos relés usando relay_slaves (não relay_states)
    const deviceIds = (devices || []).map((d: DeviceFromSupabase) => d.device_id);
    const relayStatesMap = new Map<string, RelayState[]>();
    
    if (deviceIds.length > 0) {
      // ✅ CORRETO: Usar relay_slaves (arrays)
      const { data: slaveRelays, error: relayError } = await supabase
        .from('relay_slaves')
        .select('device_id, relay_states, relay_has_timers, relay_remaining_times')
        .eq('master_device_id', masterDeviceId)
        .in('device_id', deviceIds);

      interface SlaveRelayData {
        device_id: string;
        relay_states?: boolean[];
        relay_has_timers?: boolean[];
        relay_remaining_times?: number[];
      }
      
      if (!relayError && slaveRelays) {
        // Converter arrays em objetos individuais por relé
        slaveRelays.forEach((slave: SlaveRelayData) => {
          const states = slave.relay_states || Array(8).fill(false);
          const hasTimers = slave.relay_has_timers || Array(8).fill(false);
          const remainingTimes = slave.relay_remaining_times || Array(8).fill(0);
          
          const relayStates: RelayState[] = [];
          for (let i = 0; i < 8; i++) {
            relayStates.push({
              device_id: slave.device_id,
              relay_number: i,
              state: states[i] || false,
              has_timer: hasTimers[i] || false,
              remaining_time: remainingTimes[i] || 0,
            });
          }
          
          relayStatesMap.set(slave.device_id, relayStates);
        });
      } else if (relayError) {
        console.warn('⚠️ Erro ao buscar estados de relés:', relayError);
      }
    }

    // Converter para formato ESP32Slave com estados reais dos relés
    const slaves = (devices || []).map((device: DeviceFromSupabase) => {
      const deviceRelayStates = relayStatesMap.get(device.device_id) || [];
      
      // Criar array de relés com estados reais do Supabase
      const relays = Array.from({ length: 8 }, (_, i) => {
        const relayState = deviceRelayStates.find((rs: RelayState) => rs.relay_number === i);
        return {
          relay_number: i,
          name: relayState?.relay_name || `Relé ${i}`,
          state: relayState?.state || false,
          has_timer: relayState?.has_timer || false,
          remaining_time: relayState?.remaining_time || 0,
        };
      });

      return {
        device_id: device.device_id,
        device_name: device.device_name || device.device_id,
        device_type: device.device_type || 'ESP32_SLAVE',
        mac_address: device.mac_address || '',
        is_online: device.is_online || false,
        num_relays: 8,
        last_seen: device.last_seen 
          ? Math.floor(new Date(device.last_seen).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        relays,
      };
    });

    return NextResponse.json({ slaves });
  } catch (error) {
    console.error('Error in slaves API:', error);
    return NextResponse.json(
      { error: 'Internal server error', slaves: [] },
      { status: 500 }
    );
  }
}

