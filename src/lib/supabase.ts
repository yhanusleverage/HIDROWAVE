import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';

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
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
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
  temperature: number;  // Temperatura da solução nutritiva
  ph: number;
  tds: number;
  ec?: number;  // ✅ Electrical Conductivity (pode vir da base de dados ou ser calculado de TDS)
  water_level_ok: boolean;
};

export type EnvironmentMeasurement = {
  id?: number;
  device_id?: string;
  created_at?: string;
  temperature: number;
  humidity: number;
};

export async function getLatestHydroData(): Promise<HydroMeasurement | null> {
  console.log('🔍 [SUPABASE] ========== getLatestHydroData() INICIADO ==========');
  console.log('🔍 [SUPABASE] URL:', supabaseUrl);
  console.log('🔍 [SUPABASE] Tabela: hydro_measurements');
  console.log('🔍 [SUPABASE] Query: SELECT * FROM hydro_measurements ORDER BY created_at DESC LIMIT 1');
  
  try {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
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
      console.log('✅ [SUPABASE] TDS:', data.tds, 'ppm');
      console.log('✅ [SUPABASE] Water Level OK:', data.water_level_ok);
      console.log('✅ [SUPABASE] Created At:', data.created_at);
      console.log('✅ [SUPABASE] Dados completos:', JSON.stringify(data, null, 2));
    } else {
      console.warn('⚠️ [SUPABASE] ========== NENHUM DADO HIDROPÔNICO ENCONTRADO ==========');
      console.warn('⚠️ [SUPABASE] A tabela hydro_measurements está vazia ou não retornou dados');
    }

    console.log('✅ [SUPABASE] ========== getLatestHydroData() CONCLUÍDO ==========');
    return data;
  } catch (err) {
    console.error('❌ [SUPABASE] ========== EXCEÇÃO EM getLatestHydroData() ==========');
    console.error('❌ [SUPABASE] Erro:', err);
    console.error('❌ [SUPABASE] Stack:', err instanceof Error ? err.stack : 'N/A');
    return null;
  }
}

export async function getLatestEnvironmentData(): Promise<EnvironmentMeasurement | null> {
  console.log('🔍 [SUPABASE] ========== getLatestEnvironmentData() INICIADO ==========');
  console.log('🔍 [SUPABASE] URL:', supabaseUrl);
  console.log('🔍 [SUPABASE] Tabela: environment_data');
  console.log('🔍 [SUPABASE] Query: SELECT * FROM environment_data ORDER BY created_at DESC LIMIT 1');
  
  try {
  const { data, error } = await supabase
      .from('environment_data')
    .select('*')
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

export async function getHydroDataHistory(limit: number = 24): Promise<HydroMeasurement[]> {
  console.log(`🔍 [SUPABASE] Buscando histórico hidropônico (limit: ${limit})...`);
  
  try {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
      console.error('❌ [SUPABASE] Erro ao buscar histórico hidropônico:', error);
      console.error('❌ [SUPABASE] Código:', error.code);
      console.error('❌ [SUPABASE] Mensagem:', error.message);
      return [];
    }

    const count = Array.isArray(data) ? data.length : 0;
    console.log(`✅ [SUPABASE] Histórico hidropônico: ${count} registros encontrados`);
    
    if (count > 0) {
      console.log('✅ [SUPABASE] Primeiro registro:', {
        id: data[0].id,
        temperature: data[0].temperature,
        ph: data[0].ph,
        tds: data[0].tds,
        created_at: data[0].created_at
      });
    }

    return data || [];
  } catch (err) {
    console.error('❌ [SUPABASE] Exceção ao buscar histórico hidropônico:', err);
    return [];
  }
}

export async function getEnvironmentDataHistory(limit: number = 24): Promise<EnvironmentMeasurement[]> {
  console.log(`🔍 [SUPABASE] Buscando histórico ambiental (limit: ${limit})...`);
  
  try {
  const { data, error } = await supabase
      .from('environment_data')
    .select('*')
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