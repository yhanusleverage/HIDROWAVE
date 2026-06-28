import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';

let adminClient: SupabaseClient | null = null;

/**
 * Cliente Supabase server-side para Route Handlers.
 * Preferência: SUPABASE_SERVICE_ROLE_KEY (bypass RLS em escritas confiáveis).
 * Fallback: anon key (dev sem service role).
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = serviceKey && serviceKey.length > 30 ? serviceKey : supabaseAnonKey;

  if (!serviceKey) {
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY ausente — saveSlaveRelayName usa anon (RLS pode bloquear UPDATE)'
    );
  }

  adminClient = createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
