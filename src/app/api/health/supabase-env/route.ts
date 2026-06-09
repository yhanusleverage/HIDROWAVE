import { NextResponse } from 'next/server';
import { getDeployPlatform, getServerBaseUrl } from '@/lib/app-url';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

/** Diagnóstico: env + plataforma de deploy */
export async function GET() {
  return NextResponse.json({
    ok: Boolean(supabaseUrl?.startsWith('https://') && supabaseAnonKey && supabaseAnonKey.length > 30),
    platform: getDeployPlatform(),
    baseUrl: getServerBaseUrl(),
    serverHasUrl: Boolean(supabaseUrl?.startsWith('https://')),
    serverHasAnonKey: Boolean(supabaseAnonKey && supabaseAnonKey.length > 30),
    urlPrefix: supabaseUrl ? supabaseUrl.slice(0, 32) + '...' : null,
    realtime: 'Supabase WebSocket (browser → Supabase, não requer WS no Next.js)',
  });
}
