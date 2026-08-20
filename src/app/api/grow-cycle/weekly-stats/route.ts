import { NextResponse } from 'next/server';
import { isUnknownSupabaseMissingTableError } from '@/lib/db-schema';
import { listWeeklyStats } from '@/lib/grow-cycle-plans/grow-cycle-plans-server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const instanceId = searchParams.get('instance_id') ?? undefined;

    if (!deviceId) {
      return NextResponse.json({ error: 'device_id é obrigatório' }, { status: 400 });
    }

    const stats = await listWeeklyStats(deviceId, instanceId);
    return NextResponse.json({ stats, table_available: true });
  } catch (error) {
    if (isUnknownSupabaseMissingTableError(error)) {
      return NextResponse.json({ stats: [], table_available: false });
    }
    console.error('[grow-cycle/weekly-stats] GET', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
