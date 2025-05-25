import { createClient } from '@supabase/supabase-js';

// Valores por defecto para desarrollo local (no sensibles)
const defaultSupabaseUrl = 'https://example.supabase.co';
const defaultSupabaseKey = 'public-anon-key-for-development-only';

// Usar variables de entorno si están disponibles, de lo contrario usar valores por defecto
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseKey;

// Crear cliente de Supabase con manejo de errores
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
  }
});

export default supabase; 