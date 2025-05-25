import { createClient } from '@supabase/supabase-js';

// Estas URL y KEY deben ser reemplazadas con los valores reales de tu proyecto Supabase
// o establecidas como variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mbrwdpqndasborhosewl.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Crear un cliente Supabase para usarlo en toda la aplicación
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase; 