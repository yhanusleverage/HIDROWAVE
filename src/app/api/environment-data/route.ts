import { NextResponse } from 'next/server';
import { getLatestEnvironmentData, getEnvironmentDataHistory } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    console.log(`📡 [API] /api/environment-data - history: ${history}, limit: ${limit}`);

    if (history) {
      const data = await getEnvironmentDataHistory(limit);
      console.log(`✅ [API] /api/environment-data (history): Retornando ${Array.isArray(data) ? data.length : 0} registros`);
      return NextResponse.json(data);
    } else {
      const data = await getLatestEnvironmentData();
      console.log(`✅ [API] /api/environment-data (latest):`, data ? {
        id: data.id,
        temperature: data.temperature,
        humidity: data.humidity,
        created_at: data.created_at
      } : 'null');
      return NextResponse.json(data || {});
    }
  } catch (error) {
    console.error('❌ [API] Error in environment-data API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
} 