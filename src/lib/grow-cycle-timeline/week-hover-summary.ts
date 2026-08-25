import { supabase } from '@/lib/supabase';
import { isSupabaseMissingTableError } from '@/lib/db-schema';
import type { WeekNutrientMl } from './simulation-engine';
import { emptyWeekHoverStats } from './simulation-engine';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weekTimeWindow(
  startedAt: string,
  weekIndex: number,
  now = Date.now()
): { startIso: string; endIso: string } {
  const startMs = new Date(startedAt).getTime() + weekIndex * WEEK_MS;
  const endMs = Math.min(startMs + WEEK_MS, now);
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(Math.max(startMs + 1, endMs)).toISOString(),
  };
}

async function fetchRange(
  table: string,
  select: string,
  deviceId: string,
  startIso: string,
  endIso: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq('device_id', deviceId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true })
    .limit(2000);

  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    return [];
  }
  return (data as Record<string, unknown>[]) ?? [];
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function seriesDeltaAvg(rows: Record<string, unknown>[], keys: string[]): {
  delta: number | null;
  avg: number | null;
} {
  const values: number[] = [];
  for (const row of rows) {
    for (const key of keys) {
      const v = num(row[key]);
      if (v != null) {
        values.push(v);
        break;
      }
    }
  }
  if (values.length === 0) return { delta: null, avg: null };
  const first = values[0];
  const last = values[values.length - 1];
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    delta: Math.round((last - first) * 100) / 100,
    avg: Math.round(avg * 100) / 100,
  };
}

function nutrientName(row: Record<string, unknown>): string {
  const name = String(row.nutrient_name ?? row.name ?? '').trim();
  return name || 'Nutriente';
}

export async function fetchWeekHoverStats(params: {
  deviceId: string;
  startIso: string;
  endIso: string;
}): Promise<ReturnType<typeof emptyWeekHoverStats>> {
  const { deviceId, startIso, endIso } = params;
  const empty = emptyWeekHoverStats();
  if (!deviceId.trim()) return empty;

  const [ecMetrics, phMetrics, hydro, nutrientRows, phDoses] = await Promise.all([
    fetchRange(
      'ec_controller_metrics',
      'ec_actual, created_at, adjustment_applied',
      deviceId,
      startIso,
      endIso
    ),
    fetchRange(
      'ph_controller_metrics',
      'ph_before, created_at, adjustment_applied',
      deviceId,
      startIso,
      endIso
    ),
    fetchRange('hydro_measurements', 'ec, ec_raw, ph, created_at', deviceId, startIso, endIso),
    fetchRange(
      'nutrient_dosages',
      'sequence_id, dosage_ml, created_at, nutrient_name',
      deviceId,
      startIso,
      endIso
    ),
    fetchRange('ph_dosages', 'direction, dosage_ml, created_at', deviceId, startIso, endIso),
  ]);

  const ecSeries = hydro.length > 0 ? seriesDeltaAvg(hydro, ['ec', 'ec_raw']) : seriesDeltaAvg(ecMetrics, ['ec_actual']);
  const phSeries = hydro.length > 0 ? seriesDeltaAvg(hydro, ['ph']) : seriesDeltaAvg(phMetrics, ['ph_before']);

  const byName = new Map<string, number>();
  const sequences = new Set<string>();
  let ecMlTotal = 0;
  for (const row of nutrientRows) {
    const ml = num(row.dosage_ml) ?? 0;
    if (ml <= 0) continue;
    ecMlTotal += ml;
    const seq = String(row.sequence_id ?? '').trim();
    if (seq) sequences.add(seq);
    const name = nutrientName(row);
    byName.set(name, (byName.get(name) ?? 0) + ml);
  }

  let phMlUp = 0;
  let phMlDown = 0;
  let phAdjustments = 0;
  for (const row of phDoses) {
    const ml = num(row.dosage_ml) ?? 0;
    if (ml <= 0) continue;
    phAdjustments += 1;
    const dir = String(row.direction ?? '').toLowerCase();
    if (dir === 'down' || dir === 'acid') phMlDown += ml;
    else phMlUp += ml;
  }

  const ecApplied = ecMetrics.filter((r) => r.adjustment_applied === true).length;
  const phApplied = phMetrics.filter((r) => r.adjustment_applied === true).length;

  const byNutrient: WeekNutrientMl[] = Array.from(byName.entries())
    .map(([name, ml]) => ({ name, ml: Math.round(ml * 10) / 10 }))
    .sort((a, b) => b.ml - a.ml);

  const hasWeekData =
    ecSeries.avg != null ||
    phSeries.avg != null ||
    ecMlTotal > 0 ||
    phMlUp + phMlDown > 0;

  return {
    ecDelta: ecSeries.delta,
    phDelta: phSeries.delta,
    ecAvg: ecSeries.avg,
    phAvg: phSeries.avg,
    ecMlTotal: Math.round(ecMlTotal * 10) / 10,
    phMlUp: Math.round(phMlUp * 10) / 10,
    phMlDown: Math.round(phMlDown * 10) / 10,
    ecAdjustments: sequences.size > 0 ? sequences.size : Math.max(ecApplied, 0),
    phAdjustments: phAdjustments > 0 ? phAdjustments : phApplied,
    byNutrient,
    hasWeekData,
  };
}
