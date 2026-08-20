import { NextResponse } from 'next/server';
import { isUnknownSupabaseMissingTableError } from '@/lib/db-schema';
import { fetchHydroDaily, fetchHydroHourly } from '@/lib/grow-cycle-plans/grow-cycle-plans-server';
import { getHydroDataHistory } from '@/lib/supabase';
import { HYDRO_CHART_RAW_LIMIT } from '@/lib/realtime/chart-history';
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const granularity = searchParams.get('granularity') ?? 'hour';
    const hours = parseInt(searchParams.get('hours') ?? '24', 10);
    const days = parseInt(searchParams.get('days') ?? '90', 10);

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    if (granularity === 'day') {
      const rows = await fetchHydroDaily(deviceId, days);
      return NextResponse.json({ granularity: 'day', rows, table_available: rows.length > 0 });
    }

    if (granularity === 'hour') {
      const rows = await fetchHydroHourly(deviceId, hours);
      if (rows.length > 0) {
        return NextResponse.json({ granularity: 'hour', rows, table_available: true });
      }
    }

    const rawLimit = Math.min(HYDRO_CHART_RAW_LIMIT, Math.max(24, hours * 120));
    const raw = await getHydroDataHistory(deviceId, rawLimit);
    return NextResponse.json({
      granularity: 'raw',
      rows: raw,
      table_available: true,
      fallback: true,
    });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) {
      return NextResponse.json({ rows: [], table_available: false });
    }
    console.error('[hydro-rollup] GET', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
