import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';
import {
  hasHydroSensorReading,
  hasPhReading,
  hasTemperatureReading,
} from '@/lib/realtime/hydro-sensor';
import { mergeHydroMeasurements } from '@/lib/realtime/hydro-ph';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Não definir Authorization global — quebra o JWT da sessão após login (RLS 42501 / 401)
});

if (typeof window !== 'undefined' && supabaseAnonKey.length < 30) {
  console.error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY ausente no browser. Pare o dev server, apague .next e rode npm run dev dentro de HIDROWAVE-main.'
  );
}

export type HydroMeasurement = {
  id?: number;
  device_id?: string;
  created_at?: string;
  temperature: number;
  ph: number;
  /** EC canónica µS/cm (columna preferida tras migración). */
  ec?: number | null;
  /** Legacy ppm aprox — solo histórico; no se escribe en inserts nuevos. */
  tds?: number | null;
  ph_raw?: number | null;
  ph_display_clamped?: number | null;
  ec_raw?: number | null;
  temperature_raw?: number | null;
  water_level_ok: boolean;
  level_1?: boolean;
  level_2?: boolean;
  level_3?: boolean;
  level_4?: boolean;
  water_level?: string;
};

export type EnvironmentMeasurement = {
  id?: number;
  device_id?: string;
  created_at?: string;
  temperature: number;
  humidity: number;
};

async function backfillPartialHydroRow(
  latest: HydroMeasurement,
  deviceId: string
): Promise<HydroMeasurement> {
  const needsPh = !hasPhReading(latest);
  const needsTemp = !hasTemperatureReading(latest);
  if (!needsPh && !needsTemp) return latest;
  if (!hasHydroSensorReading(latest) && !needsPh && !needsTemp) return latest;

  const { data: recentRows } = await supabase
    .from('hydro_measurements')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!recentRows?.length) return latest;

  let merged = latest;

  if (needsPh) {
    const donor = recentRows.find((row) => hasPhReading(row));
    if (donor) {
      merged = mergeHydroMeasurements(donor as HydroMeasurement, merged);
      console.log('ℹ️ [SUPABASE] Backfill pH desde fila', donor.id);
    }
  }

  if (!hasTemperatureReading(merged)) {
    const donor = recentRows.find((row) => hasTemperatureReading(row));
    if (donor) {
      merged = mergeHydroMeasurements(donor as HydroMeasurement, merged);
      console.log('ℹ️ [SUPABASE] Backfill temperatura desde fila', donor.id);
    }
  }

  return merged;
}

export async function getLatestHydroData(deviceId: string): Promise<HydroMeasurement | null> {
  console.log('🔍 [SUPABASE] getLatestHydroData device_id=', deviceId);

  try {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

    console.log('📊 [SUPABASE] Query executada. Verificando resultado...');

  if (error) {
      console.error('❌ [SUPABASE] ========== ERRO AO BUSCAR HYDRO_MEASUREMENTS ==========');
      console.error('❌ [SUPABASE] Código do erro:', error.code);
      console.error('❌ [SUPABASE] Mensagem:', error.message);
      console.error('❌ [SUPABASE] Detalhes:', error.details);
      console.error('❌ [SUPABASE] Hint:', error.hint);
      console.error('❌ [SUPABASE] Erro completo:', JSON.stringify(error, null, 2));
      return null;
    }

    if (data) {
      console.log('✅ [SUPABASE] ========== HYDRO_MEASUREMENTS ENCONTRADO ==========');
      console.log('✅ [SUPABASE] ID:', data.id);
      console.log('✅ [SUPABASE] Device ID:', data.device_id);
      console.log('✅ [SUPABASE] Temperature:', data.temperature, '°C');
      console.log('✅ [SUPABASE] pH:', data.ph);
      console.log('✅ [SUPABASE] EC:', data.ec ?? data.ec_raw, 'µS/cm');
      console.log('✅ [SUPABASE] Water Level OK:', data.water_level_ok);
      console.log('✅ [SUPABASE] Created At:', data.created_at);
      console.log('✅ [SUPABASE] Dados completos:', JSON.stringify(data, null, 2));

      if (!hasHydroSensorReading(data)) {
        const { data: recentRows } = await supabase
          .from('hydro_measurements')
          .select('*')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(50);
        const lastWithSensor = (recentRows ?? []).find((row) => hasHydroSensorReading(row));
        if (lastWithSensor) {
          const merged = mergeHydroMeasurements(lastWithSensor as HydroMeasurement, data);
          console.log('ℹ️ [SUPABASE] Última fila solo-niveles — PV de fila', lastWithSensor.id);
          return merged;
        }
      }

      const backfilled = await backfillPartialHydroRow(data as HydroMeasurement, deviceId);
      console.log('✅ [SUPABASE] ========== getLatestHydroData() CONCLUÍDO ==========');
      return backfilled;
    }

    console.warn('⚠️ [SUPABASE] ========== NENHUM DADO HIDROPÔNICO ENCONTRADO ==========');
    console.warn('⚠️ [SUPABASE] A tabela hydro_measurements está vazia ou não retornou dados');
    return null;
  } catch (err) {
    console.error('❌ [SUPABASE] ========== EXCEÇÃO EM getLatestHydroData() ==========');
    console.error('❌ [SUPABASE] Erro:', err);
    console.error('❌ [SUPABASE] Stack:', err instanceof Error ? err.stack : 'N/A');
    return null;
  }
}

export async function getLatestEnvironmentData(deviceId: string): Promise<EnvironmentMeasurement | null> {
  console.log('🔍 [SUPABASE] getLatestEnvironmentData device_id=', deviceId);

  try {
  const { data, error } = await supabase
      .from('environment_data')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

    console.log('📊 [SUPABASE] Query executada. Verificando resultado...');

  if (error) {
      console.error('❌ [SUPABASE] ========== ERRO AO BUSCAR ENVIRONMENT_DATA ==========');
      console.error('❌ [SUPABASE] Código do erro:', error.code);
      console.error('❌ [SUPABASE] Mensagem:', error.message);
      console.error('❌ [SUPABASE] Detalhes:', error.details);
      console.error('❌ [SUPABASE] Hint:', error.hint);
      console.error('❌ [SUPABASE] Erro completo:', JSON.stringify(error, null, 2));
      return null;
    }

    if (data) {
      console.log('✅ [SUPABASE] ========== ENVIRONMENT_DATA ENCONTRADO ==========');
      console.log('✅ [SUPABASE] ID:', data.id);
      console.log('✅ [SUPABASE] Device ID:', data.device_id);
      console.log('✅ [SUPABASE] Temperature:', data.temperature, '°C');
      console.log('✅ [SUPABASE] Humidity:', data.humidity, '%');
      console.log('✅ [SUPABASE] Created At:', data.created_at);
      console.log('✅ [SUPABASE] Dados completos:', JSON.stringify(data, null, 2));
    } else {
      console.warn('⚠️ [SUPABASE] ========== NENHUM DADO AMBIENTAL ENCONTRADO ==========');
      console.warn('⚠️ [SUPABASE] A tabela environment_data está vazia ou não retornou dados');
    }

    console.log('✅ [SUPABASE] ========== getLatestEnvironmentData() CONCLUÍDO ==========');
    return data;
  } catch (err) {
    console.error('❌ [SUPABASE] ========== EXCEÇÃO EM getLatestEnvironmentData() ==========');
    console.error('❌ [SUPABASE] Erro:', err);
    console.error('❌ [SUPABASE] Stack:', err instanceof Error ? err.stack : 'N/A');
    return null;
  }
}

export async function getHydroDataHistory(deviceId: string, limit: number = 24): Promise<HydroMeasurement[]> {
  console.log(`🔍 [SUPABASE] Histórico hidropônico device_id=${deviceId} limit=${limit}`);

  try {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
      console.error('❌ [SUPABASE] Erro ao buscar histórico hidropônico:', error);
      console.error('❌ [SUPABASE] Código:', error.code);
      console.error('❌ [SUPABASE] Mensagem:', error.message);
      return [];
    }

    const rows = data || [];
    const sensorRows = rows.filter((row) => hasHydroSensorReading(row));
    if (sensorRows.length > 0) {
      console.log(`✅ [SUPABASE] Histórico hidropônico: ${sensorRows.length} com PV sensor (${rows.length} total)`);
      return sensorRows;
    }

    console.log(`✅ [SUPABASE] Histórico hidropônico: ${rows.length} registros (sem PV sensor)`);
    return rows;
  } catch (err) {
    console.error('❌ [SUPABASE] Exceção ao buscar histórico hidropônico:', err);
    return [];
  }
}

export async function getEnvironmentDataHistory(deviceId: string, limit: number = 24): Promise<EnvironmentMeasurement[]> {
  console.log(`🔍 [SUPABASE] Histórico ambiental device_id=${deviceId} limit=${limit}`);

  try {
  const { data, error } = await supabase
      .from('environment_data')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
      console.error('❌ [SUPABASE] Erro ao buscar histórico ambiental:', error);
      console.error('❌ [SUPABASE] Código:', error.code);
      console.error('❌ [SUPABASE] Mensagem:', error.message);
      return [];
    }

    const count = Array.isArray(data) ? data.length : 0;
    console.log(`✅ [SUPABASE] Histórico ambiental: ${count} registros encontrados`);
    
    if (count > 0) {
      console.log('✅ [SUPABASE] Primeiro registro:', {
        id: data[0].id,
        temperature: data[0].temperature,
        humidity: data[0].humidity,
        created_at: data[0].created_at
      });
    }

    return data || [];
  } catch (err) {
    console.error('❌ [SUPABASE] Exceção ao buscar histórico ambiental:', err);
    return [];
  }
}

export async function toggleRelay(relayNumber: number, seconds: number): Promise<boolean> {
  // This is a mock function that would actually call an API endpoint 
  // to control the ESP32 device
  try {
    const response = await fetch('/api/relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ relay: relayNumber, seconds }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to toggle relay');
    }
    
    return true;
  } catch (error) {
    console.error('Error toggling relay:', error);
    return false;
  }
} 