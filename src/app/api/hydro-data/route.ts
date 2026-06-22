import { NextResponse } from 'next/server';
import { getLatestHydroData, getHydroDataHistory } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    console.log(`📡 [API] /api/hydro-data device_id=${deviceId} history=${history} limit=${limit}`);

    if (history) {
      const data = await getHydroDataHistory(deviceId, limit);
      return NextResponse.json(data);
    }

    const data = await getLatestHydroData(deviceId);
    return NextResponse.json(data || {});
  } catch (error) {
    console.error('❌ [API] Error in hydro-data API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
