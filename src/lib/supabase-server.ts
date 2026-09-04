import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';

let adminClient: SupabaseClient | null = null;

/**
 * Cliente Supabase server-side para Route Handlers.
 * Preferência: SUPABASE_SERVICE_ROLE_KEY (bypass RLS em escritas confiáveis).
 * Fallback: anon key (dev sem service role) — RLS pode bloquear decision_rules.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = serviceKey && serviceKey.length > 30 ? serviceKey : supabaseAnonKey;

  if (!serviceKey || serviceKey.length <= 30) {
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY ausente — escritas usam anon (RLS pode bloquear decision_rules). Prefira Bearer do usuário ou defina service role em .env.local.'
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

/** true se o server tem service_role (bypass RLS). */
export function hasSupabaseServiceRole(): boolean {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(serviceKey && serviceKey.length > 30);
}

/**
 * Cliente com JWT do usuário (Authorization: Bearer …).
 * Respeita RLS de decision_rules (authenticated + email em device_status).
 */
export function getSupabaseUserClientFromAuthHeader(
  authorization: string | null | undefined
): SupabaseClient | null {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authorization.slice(7).trim();
  if (token.length < 20) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Cliente para escritas em decision_rules:
 * 1) service_role se existir
 * 2) senão Bearer do request (RLS authenticated)
 * 3) null → caller deve falhar com mensagem clara
 */
export function getSupabaseWriterForDecisionRules(
  authorization?: string | null
): { client: SupabaseClient; mode: 'service_role' | 'user_jwt' } | null {
  if (hasSupabaseServiceRole()) {
    return { client: getSupabaseServerClient(), mode: 'service_role' };
  }
  const userClient = getSupabaseUserClientFromAuthHeader(authorization);
  if (userClient) {
    return { client: userClient, mode: 'user_jwt' };
  }
  return null;
}
