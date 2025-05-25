import { NextResponse } from 'next/server';
import { getLatestEnvironmentData, getEnvironmentDataHistory } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    if (history) {
      const data = await getEnvironmentDataHistory(limit);
      return NextResponse.json(data);
    } else {
      const data = await getLatestEnvironmentData();
      return NextResponse.json(data || {});
    }
  } catch (error) {
    console.error('Error in environment-data API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 