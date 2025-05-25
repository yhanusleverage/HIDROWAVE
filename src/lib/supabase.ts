import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icndkcHFuZGFzYm9yaG9zZXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNDI3MzEsImV4cCI6MjA2MzcxODczMX0.ouRWHqrXv0Umk8SfbyGJoc-TA2vPaGDoC_OS-auj1-A';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type HydroMeasurement = {
  id?: number;
  created_at?: string;
  water_temperature: number;
  ph: number;
  tds: number;
  ec: number;
  water_level_ok: boolean;
};

export type EnvironmentMeasurement = {
  id?: number;
  created_at?: string;
  temperature: number;
  humidity: number;
};

export async function getLatestHydroData(): Promise<HydroMeasurement | null> {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching hydro data:', error);
    return null;
  }

  return data;
}

export async function getLatestEnvironmentData(): Promise<EnvironmentMeasurement | null> {
  const { data, error } = await supabase
    .from('environment_measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching environment data:', error);
    return null;
  }

  return data;
}

export async function getHydroDataHistory(limit: number = 24): Promise<HydroMeasurement[]> {
  const { data, error } = await supabase
    .from('hydro_measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching hydro history:', error);
    return [];
  }

  return data || [];
}

export async function getEnvironmentDataHistory(limit: number = 24): Promise<EnvironmentMeasurement[]> {
  const { data, error } = await supabase
    .from('environment_measurements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching environment history:', error);
    return [];
  }

  return data || [];
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