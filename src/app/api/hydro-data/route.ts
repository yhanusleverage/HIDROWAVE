import { NextResponse } from 'next/server';
import { getLatestHydroData, getHydroDataHistory } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    console.log(`📡 [API] /api/hydro-data - history: ${history}, limit: ${limit}`);

    if (history) {
      const data = await getHydroDataHistory(limit);
      console.log(`✅ [API] /api/hydro-data (history): Retornando ${Array.isArray(data) ? data.length : 0} registros`);
      return NextResponse.json(data);
    } else {
      const data = await getLatestHydroData();
      console.log(`✅ [API] /api/hydro-data (latest):`, data ? {
        id: data.id,
        temperature: data.temperature,
        ph: data.ph,
        tds: data.tds,
        created_at: data.created_at
      } : 'null');
      return NextResponse.json(data || {});
    }
  } catch (error) {
    console.error('❌ [API] Error in hydro-data API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
} 