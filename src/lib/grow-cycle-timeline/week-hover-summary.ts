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
  if (!Array.isArray(data)) return [];
  return data as unknown as Record<string, unknown>[];
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export type WeekSeriesStats = {
  first: number | null;
  last: number | null;
  avg: number | null;
  avgDailyDrop: number | null;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Inicial / final da janela + queda média/dia.
 * queda_d = max(0, primeiro_do_dia − último_do_dia)
 * média = soma(queda_d) / dias com ≥ 2 samples (dias que só subiram entram como 0).
 */
export function computeWeekSeriesStats(
  rows: Record<string, unknown>[],
  keys: string[]
): WeekSeriesStats {
  const points: { t: number; v: number }[] = [];
  for (const row of rows) {
    const t = isoMs(row.created_at);
    if (t == null) continue;
    for (const key of keys) {
      const v = num(row[key]);
      if (v != null) {
        points.push({ t, v });
        break;
      }
    }
  }
  if (points.length === 0) {
    return { first: null, last: null, avg: null, avgDailyDrop: null };
  }

  const first = points[0].v;
  const last = points[points.length - 1].v;
  const avg = points.reduce((s, p) => s + p.v, 0) / points.length;

  const byDay = new Map<string, { first: number; last: number; n: number }>();
  for (const p of points) {
    const day = new Date(p.t).toISOString().slice(0, 10);
    const bucket = byDay.get(day);
    if (!bucket) byDay.set(day, { first: p.v, last: p.v, n: 1 });
    else {
      bucket.last = p.v;
      bucket.n += 1;
    }
  }

  let dropSum = 0;
  let sampleDays = 0;
  for (const day of byDay.values()) {
    if (day.n < 2) continue;
    sampleDays += 1;
    dropSum += Math.max(0, day.first - day.last);
  }

  return {
    first: round2(first),
    last: round2(last),
    avg: round2(avg),
    avgDailyDrop: sampleDays > 0 ? round2(dropSum / sampleDays) : null,
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

  const ecSeries =
    hydro.length > 0
      ? computeWeekSeriesStats(hydro, ['ec', 'ec_raw'])
      : computeWeekSeriesStats(ecMetrics, ['ec_actual']);
  const phSeries =
    hydro.length > 0
      ? computeWeekSeriesStats(hydro, ['ph'])
      : computeWeekSeriesStats(phMetrics, ['ph_before']);

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
    ecSeries.first != null ||
    phSeries.first != null ||
    ecMlTotal > 0 ||
    phMlUp + phMlDown > 0;

  return {
    ecFirst: ecSeries.first,
    ecLast: ecSeries.last,
    ecAvgDailyDrop: ecSeries.avgDailyDrop,
    phFirst: phSeries.first,
    phLast: phSeries.last,
    phAvgDailyDrop: phSeries.avgDailyDrop,
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
