/**
 * API Client para comunicação com ESP32 Master
 * 
 * Este módulo fornece funções para buscar dados diretamente do ESP32 Master
 * via HTTP (endpoint /api/slaves)
 */

import { supabase } from './supabase';
import { resolveSlaveOnline } from './realtime/slave-status';

/**
 * Interface para relé retornado pelo ESP32 Master
 */
export interface ESP32Relay {
  relay_number: number;
  name: string;
  state: boolean;
  has_timer: boolean;
  remaining_time: number;
}

/**
 * Interface para slave retornado pelo ESP32 Master
 */
export interface ESP32Slave {
  device_id: string;
  device_name: string;
  device_type: string;
  mac_address: string;
  is_online: boolean;
  num_relays: number;
  last_seen: number;
  relays: ESP32Relay[];
}

/**
 * Interface para resposta do endpoint /api/slaves
 * (Não usado atualmente, mas mantido para referência futura)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ESP32SlavesResponse {
  slaves: ESP32Slave[];
}

interface DeviceStatusFromSupabase {
  device_id: string;
  device_name?: string;
  device_type?: string;
  mac_address?: string;
  last_seen?: string;
  [key: string]: unknown;
}

interface SlaveRelayFromSupabase {
  device_id: string;
  relay_states?: boolean[];
  relay_has_timers?: boolean[];
  relay_remaining_times?: number[];
  last_update?: string;
  updated_at?: string;
  relay_name?: string;
}

interface RelayState {
  device_id: string;
  relay_number: number;
  state: boolean;
  has_timer: boolean;
  remaining_time: number;
  relay_name?: string;
}

/**
 * Busca o IP do Master a partir do device_status
 * 
 * @param masterDeviceId ID do dispositivo Master
 * @returns IP do Master ou null se não encontrado
 */
export async function getMasterIP(masterDeviceId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('device_status')
      .select('ip_address')
      .eq('device_id', masterDeviceId)
      .single();

    if (error || !data) {
      console.error('Erro ao buscar IP do Master:', error);
      return null;
    }

    // ip_address pode ser string ou objeto inet do PostgreSQL
    const ipAddress = typeof data.ip_address === 'string' 
      ? data.ip_address 
      : data.ip_address?.toString() || null;

    return ipAddress;
  } catch (error) {
    console.error('Erro ao buscar IP do Master:', error);
    return null;
  }
}

/**
 * ✅ FALLBACK: Busca slaves ESP-NOW diretamente do Supabase
 * Usado quando o Master não está acessível
 * 
 * @param masterDeviceId ID do dispositivo Master (para filtrar slaves do mesmo usuário)
 * @returns Lista de slaves do Supabase
 */
export async function getSlavesFromSupabase(masterDeviceId: string): Promise<ESP32Slave[]> {
  try {
    // Buscar Master para obter user_email
    const { data: masterData } = await supabase
      .from('device_status')
      .select('user_email')
      .eq('device_id', masterDeviceId)
      .single();

    const userEmail = masterData?.user_email;

    // ✅ Buscar slaves do Supabase de várias formas:
    // 1. device_type contém "slave", "relaybox", "relay"
    // 2. device_id começa com "ESP32_SLAVE_"
    // 3. device_name contém "SLAVE" ou "RelayBox"
    let query = supabase
      .from('device_status')
      .select('*')
      .or('device_type.ilike.%slave%,device_type.ilike.%relaybox%,device_type.ilike.%relay%,device_id.ilike.ESP32_SLAVE_%,device_name.ilike.%SLAVE%,device_name.ilike.%RelayBox%')
      .order('last_seen', { ascending: false });

    // Se Master tem user_email, filtrar slaves do mesmo usuário
    if (userEmail) {
      query = query.eq('user_email', userEmail);
      console.log(`🔍 Buscando slaves do Supabase com user_email: ${userEmail}`);
    } else {
      console.log('⚠️ Master não tem user_email, buscando todos os slaves (sem filtro)');
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar slaves do Supabase:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('⚠️ Nenhum slave encontrado no Supabase');
      console.log('💡 Verifique se:');
      console.log('   - Slaves estão registrados no Supabase');
      console.log('   - Slaves têm user_email correto');
      console.log('   - device_type contém "slave", "relaybox" ou "relay"');
      return [];
    }

    console.log(`✅ ${data.length} slave(s) encontrado(s) no Supabase:`, data.map(d => ({
      device_id: d.device_id,
      device_name: d.device_name,
      device_type: d.device_type,
      user_email: d.user_email,
      mac_address: d.mac_address
    })));

    // ✅ Buscar estados dos relés usando relay_slaves (não relay_states)
    const deviceIds = data.map((d: DeviceStatusFromSupabase) => d.device_id);
    const relayStatesMap = new Map<string, RelayState[]>();
    // ✅ Criar mapa de last_update por device_id (fora do if para estar no escopo correto)
    const slaveLastUpdateMap = new Map<string, string>();
    
    if (deviceIds.length > 0) {
      // ✅ CORRETO: Usar relay_slaves (arrays) + last_update para calcular status
      const { data: slaveRelays, error: relayError } = await supabase
        .from('relay_slaves')
        .select('device_id, relay_states, relay_has_timers, relay_remaining_times, last_update, updated_at')
        .eq('master_device_id', masterDeviceId)
        .in('device_id', deviceIds);
      
      if (!relayError && slaveRelays) {
        // Converter arrays em objetos individuais por relé
        slaveRelays.forEach((slave: SlaveRelayFromSupabase) => {
          // ✅ Guardar last_update para usar no cálculo de status
          const lastUpdate = slave.last_update || slave.updated_at;
          if (lastUpdate) {
            slaveLastUpdateMap.set(slave.device_id, lastUpdate);
          }
          
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
        console.log(`✅ Estados de ${slaveRelays.length} slave(s) encontrado(s) em relay_slaves`);
      } else if (relayError) {
        console.warn('⚠️ Erro ao buscar estados de relés:', relayError);
      }
    }

    // Converter DeviceStatus para ESP32Slave com estados reais dos relés
    const slaves: ESP32Slave[] = data.map((device: DeviceStatusFromSupabase) => {
      const deviceRelayStates = relayStatesMap.get(device.device_id) || [];
      
      // Online unificado: relay_slaves.last_update (preferido) ou device_status.last_seen
      const relaySlaveLastUpdate = slaveLastUpdateMap.get(device.device_id);
      const calculatedIsOnline = resolveSlaveOnline(relaySlaveLastUpdate, device.last_seen);

      const lastSeenTimestamp = relaySlaveLastUpdate
        ? Math.floor(new Date(relaySlaveLastUpdate).getTime() / 1000)
        : device.last_seen
          ? Math.floor(new Date(device.last_seen).getTime() / 1000)
          : null;

      console.log(
        `🔍 [ESP32-API] Slave ${device.device_id}: is_online=${calculatedIsOnline}` +
          (relaySlaveLastUpdate ? ` last_update=${relaySlaveLastUpdate}` : '')
      );
      
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
        is_online: calculatedIsOnline, // ✅ Status recalculado
        num_relays: 8, // Default para slaves ESP-NOW
        last_seen: lastSeenTimestamp || Math.floor(Date.now() / 1000),
        relays,
      };
    });

    console.log(`✅ ${slaves.length} slaves encontrados no Supabase`);
    return slaves;
  } catch (error) {
    console.error('Erro ao buscar slaves do Supabase:', error);
    return [];
  }
}

/**
 * Busca slaves do ESP32 Master
 * 
 * ✅ CORRIGIDO: Agora usa APENAS Supabase (sem fetch direto a IP privada)
 * Isso permite que o sistema funcione em produção (Vercel) de qualquer lugar do mundo
 * 
 * @param masterDeviceId ID do dispositivo Master
 * @returns Lista de slaves do Supabase
 */
export async function getSlavesFromMaster(masterDeviceId: string): Promise<ESP32Slave[]> {
  // ✅ Usar apenas Supabase (sem fetch direto)
  console.log(`🔍 Buscando slaves do Supabase para Master: ${masterDeviceId}`);
  return await getSlavesFromSupabase(masterDeviceId);
}

/**
 * Busca nomes personalizados dos relés da tabela relay_names
 * 
 * ✅ CORRIGIDO: Agora usa endpoint API route (não chamada direta ao Supabase no cliente)
 * Isso garante que a chave de API seja enviada corretamente
 * 
 * @param deviceIds Array de device_ids dos slaves
 * @returns Mapa de device_id -> relay_number -> relay_name
 */
export async function getRelayNamesFromSupabase(
  deviceIds: string[]
): Promise<Map<string, Map<number, string>>> {
  const relayNamesMap = new Map<string, Map<number, string>>();

  if (deviceIds.length === 0) {
    return relayNamesMap;
  }

  try {
    // ✅ Usar endpoint API route em vez de chamada direta ao Supabase
    // Isso garante que a chave de API seja enviada corretamente (server-side)
    const deviceIdsParam = deviceIds.join(',');
    const response = await fetch(`/api/relay-names?device_ids=${encodeURIComponent(deviceIdsParam)}`);
    
    if (!response.ok) {
      console.error('Erro ao buscar nomes de relés:', response.statusText);
      return relayNamesMap;
    }
    
    const result = await response.json();
    const relayNamesData = result.relay_names || {};
    
    // Converter objeto para Map: device_id -> relay_number -> relay_name
    Object.keys(relayNamesData).forEach((deviceId) => {
      const deviceRelayNames = relayNamesData[deviceId];
      const deviceMap = new Map<number, string>();
      
      Object.keys(deviceRelayNames).forEach((relayNumberStr) => {
        const relayNumber = parseInt(relayNumberStr, 10);
        deviceMap.set(relayNumber, deviceRelayNames[relayNumber]);
      });
      
      relayNamesMap.set(deviceId, deviceMap);
    });

    return relayNamesMap;
  } catch (error) {
    console.error('Erro ao buscar nomes de relés:', error);
    return relayNamesMap;
  }
}

