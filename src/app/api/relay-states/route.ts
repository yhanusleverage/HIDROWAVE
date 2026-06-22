import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * ⚠️ DEPRECATED: Esta API foi substituída por relay-slaves-api.ts
 * 
 * Esta API não é mais usada. O frontend agora usa:
 * - getSlaveRelayStates() de relay-slaves-api.ts (para slaves)
 * - relay_master (para relés locais do master)
 * 
 * Mantida apenas para compatibilidade durante migração.
 * 
 * Query params:
 * - master_device_id: ID do Master (obrigatório)
 * - device_ids: Array de device_ids separados por vírgula (opcional)
 * - relay_type: 'local' ou 'slave' (opcional, padrão: 'slave')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const masterDeviceId = searchParams.get('master_device_id');
    const deviceIdsParam = searchParams.get('device_ids');
    const relayType = searchParams.get('relay_type') || 'slave';
    
    if (!masterDeviceId) {
      return NextResponse.json(
        { error: 'master_device_id é obrigatório', relay_states: [] },
        { status: 400 }
      );
    }
    
    // ✅ CORRIGIDO: Usar relay_slaves para slaves, relay_master para locais
    if (relayType === 'slave') {
      // Buscar de relay_slaves (arrays)
      let queryBuilder = supabase
        .from('relay_slaves')
        .select('device_id, relay_states, relay_has_timers, relay_remaining_times')
        .eq('master_device_id', masterDeviceId);
      
      if (deviceIdsParam) {
        const deviceIds = deviceIdsParam.split(',').filter(id => id.trim().length > 0);
        if (deviceIds.length > 0) {
          queryBuilder = queryBuilder.in('device_id', deviceIds);
        }
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Erro ao buscar estados de relés de slaves:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar estados de relés', relay_states: [] },
          { status: 500 }
        );
      }
      
      interface SlaveRelayData {
        device_id: string;
        relay_states?: boolean[];
        relay_has_timers?: boolean[];
        relay_remaining_times?: number[];
      }
      
      interface RelayState {
        device_id: string;
        relay_number: number;
        state: boolean;
        has_timer: boolean;
        remaining_time: number;
      }
      
      // Converter arrays em objetos individuais por relé
      const relayStates: RelayState[] = [];
      if (data) {
        data.forEach((slave: SlaveRelayData) => {
          const states = slave.relay_states || Array(8).fill(false);
          const hasTimers = slave.relay_has_timers || Array(8).fill(false);
          const remainingTimes = slave.relay_remaining_times || Array(8).fill(0);
          
          for (let i = 0; i < 8; i++) {
            relayStates.push({
              device_id: slave.device_id,
              relay_number: i,
              state: states[i] || false,
              has_timer: hasTimers[i] || false,
              remaining_time: remainingTimes[i] || 0,
            });
          }
        });
      }
      
      return NextResponse.json({ relay_states: relayStates });
    } else {
      // Para relés locais, usar relay_master
      const query = supabase
        .from('relay_master')
        .select('device_id, doser_relay_states, level_relay_states, reserved_relay_states')
        .eq('device_id', masterDeviceId);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar estados de relés locais:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar estados de relés', relay_states: [] },
          { status: 500 }
        );
      }
      
      interface RelayState {
        device_id: string;
        relay_number: number;
        state: boolean;
        has_timer: boolean;
        remaining_time: number;
      }
      
      // Converter arrays em objetos individuais por relé
      const relayStates: RelayState[] = [];
      if (data && data.length > 0) {
        const master = data[0];
        const doserStates = master.doser_relay_states || Array(8).fill(false);
        const levelStates = master.level_relay_states || Array(4).fill(false);
        const reservedStates = master.reserved_relay_states || Array(4).fill(false);
        
        // Doser relays (0-7)
        for (let i = 0; i < 8; i++) {
          relayStates.push({
            device_id: master.device_id,
            relay_number: i,
            state: doserStates[i] || false,
            has_timer: false,
            remaining_time: 0,
          });
        }
        
        // Level relays (8-11)
        for (let i = 0; i < 4; i++) {
          relayStates.push({
            device_id: master.device_id,
            relay_number: i + 8,
            state: levelStates[i] || false,
            has_timer: false,
            remaining_time: 0,
          });
        }
        
        // Reserved relays (12-15)
        for (let i = 0; i < 4; i++) {
          relayStates.push({
            device_id: master.device_id,
            relay_number: i + 12,
            state: reservedStates[i] || false,
            has_timer: false,
            remaining_time: 0,
          });
        }
      }
      
      return NextResponse.json({ relay_states: relayStates });
    }
  } catch (error) {
    console.error('Erro em GET /api/relay-states:', error);
    return NextResponse.json(
      { error: 'Internal server error', relay_states: [] },
      { status: 500 }
    );
  }
}

