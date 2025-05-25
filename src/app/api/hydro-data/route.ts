import { NextResponse } from 'next/server';
import { getLatestHydroData, getHydroDataHistory } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    if (history) {
      const data = await getHydroDataHistory(limit);
      return NextResponse.json(data);
    } else {
      const data = await getLatestHydroData();
      return NextResponse.json(data || {});
    }
  } catch (error) {
    console.error('Error in hydro-data API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 