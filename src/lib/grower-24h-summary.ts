import { supabase } from '@/lib/supabase';
import { isSupabaseMissingTableError } from '@/lib/db-schema';

export const GROWER_24H_MS = 24 * 60 * 60 * 1000;
/** Menos de 20 h: ainda não dá para comparar “há 24 h”. */
export const GROWER_24H_MIN_SPAN_MS = 20 * 60 * 60 * 1000;

export type GrowerTrend = 'down' | 'up' | 'stable' | 'waiting';

export type NutrientMlSlice = {
  name: string;
  ml: number;
};

export type Ec24hSnapshot = {
  historyMs: number;
  hasFullWindow: boolean;
  thenValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  totalMl: number;
  doseCount: number;
  byNutrient: NutrientMlSlice[];
};

export type Ph24hSnapshot = {
  historyMs: number;
  hasFullWindow: boolean;
  thenValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  totalMl: number;
  mlUp: number;
  mlDown: number;
  doseCount: number;
};

export type GrowerDelta = {
  trend: GrowerTrend;
  delta: number | null;
  label: string;
};

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIsoMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatMl(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatAgoPt(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function interpretEcDelta(
  now: number | null,
  then: number | null,
  tolerance: number,
  hasFullWindow: boolean
): GrowerDelta {
  if (!hasFullWindow || now == null || then == null) {
    return { trend: 'waiting', delta: null, label: 'Aguardando histórico de 24 h' };
  }
  const delta = now - then;
  const band = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
  if (Math.abs(delta) <= band) {
    return { trend: 'stable', delta, label: 'Estável (dentro da tolerância)' };
  }
  if (delta < 0) {
    return { trend: 'down', delta, label: 'Plantas comeram (EC caiu)' };
  }
  return { trend: 'up', delta, label: 'EC subiu — evaporação?' };
}

export function interpretPhDelta(
  now: number | null,
  then: number | null,
  tolerance: number,
  hasFullWindow: boolean
): GrowerDelta {
  if (!hasFullWindow || now == null || then == null) {
    return { trend: 'waiting', delta: null, label: 'Aguardando histórico de 24 h' };
  }
  const delta = now - then;
  const band = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
  if (Math.abs(delta) <= band) {
    return { trend: 'stable', delta, label: 'Estável (dentro da tolerância)' };
  }
  if (delta > 0) {
    return { trend: 'up', delta, label: 'pH subiu — correção Down' };
  }
  return { trend: 'down', delta, label: 'pH desceu — correção Up' };
}

async function fetchDeviceRows(
  table: string,
  select: string,
  deviceId: string,
  sinceIso: string
): Promise<Record<string, unknown>[]> {
  const id = deviceId.trim();
  if (!id) return [];

  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq('device_id', id)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(2000);

  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    return [];
  }
  return ((data as unknown) as Record<string, unknown>[]) ?? [];
}

function seriesStats(
  rows: Record<string, unknown>[],
  valueKey: string
): {
  thenValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  historyMs: number;
} {
  const points: { t: number; v: number }[] = [];
  for (const row of rows) {
    const v = asNumber(row[valueKey]);
    const t = asIsoMs(row.created_at);
    if (v == null || t == null) continue;
    points.push({ t, v });
  }
  if (points.length === 0) {
    return { thenValue: null, minValue: null, maxValue: null, historyMs: 0 };
  }
  let min = points[0].v;
  let max = points[0].v;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return {
    thenValue: first.v,
    minValue: min,
    maxValue: max,
    historyMs: Math.max(0, last.t - first.t),
  };
}

function nutrientLabel(row: Record<string, unknown>): string {
  const raw = row.nutrient_name ?? row.nutrient_name ?? row.name;
  const name = String(raw ?? '').trim();
  return name || 'Nutriente';
}

function emptyEc(): Ec24hSnapshot {
  return {
    historyMs: 0,
    hasFullWindow: false,
    thenValue: null,
    minValue: null,
    maxValue: null,
    totalMl: 0,
    doseCount: 0,
    byNutrient: [],
  };
}

function emptyPh(): Ph24hSnapshot {
  return {
    historyMs: 0,
    hasFullWindow: false,
    thenValue: null,
    minValue: null,
    maxValue: null,
    totalMl: 0,
    mlUp: 0,
    mlDown: 0,
    doseCount: 0,
  };
}

export async function fetchEc24hSnapshot(deviceId: string): Promise<Ec24hSnapshot> {
  if (!deviceId.trim()) return emptyEc();
  const sinceIso = new Date(Date.now() - GROWER_24H_MS).toISOString();

  const [metrics, dosages] = await Promise.all([
    fetchDeviceRows('ec_controller_metrics', 'ec_actual, created_at', deviceId, sinceIso),
    fetchDeviceRows(
      'nutrient_dosages',
      'sequence_id, dosage_ml, created_at, nutrient_name',
      deviceId,
      sinceIso
    ),
  ]);

  const stats = seriesStats(metrics, 'ec_actual');
  const byName = new Map<string, number>();
  const sequences = new Set<string>();
  let totalMl = 0;

  for (const row of dosages) {
    const ml = asNumber(row.dosage_ml) ?? 0;
    if (ml <= 0) continue;
    totalMl += ml;
    const seq = String(row.sequence_id ?? '').trim();
    if (seq) sequences.add(seq);
    const name = nutrientLabel(row);
    byName.set(name, (byName.get(name) ?? 0) + ml);
  }

  return {
    historyMs: stats.historyMs,
    hasFullWindow: stats.historyMs >= GROWER_24H_MIN_SPAN_MS,
    thenValue: stats.thenValue,
    minValue: stats.minValue,
    maxValue: stats.maxValue,
    totalMl: Math.round(totalMl * 10) / 10,
    doseCount: sequences.size > 0 ? sequences.size : dosages.filter((r) => (asNumber(r.dosage_ml) ?? 0) > 0).length,
    byNutrient: Array.from(byName.entries())
      .map(([name, ml]) => ({ name, ml: Math.round(ml * 10) / 10 }))
      .sort((a, b) => b.ml - a.ml),
  };
}

export async function fetchPh24hSnapshot(deviceId: string): Promise<Ph24hSnapshot> {
  if (!deviceId.trim()) return emptyPh();
  const sinceIso = new Date(Date.now() - GROWER_24H_MS).toISOString();

  const [metrics, dosages] = await Promise.all([
    fetchDeviceRows('ph_controller_metrics', 'ph_before, created_at', deviceId, sinceIso),
    fetchDeviceRows('ph_dosages', 'direction, dosage_ml, created_at', deviceId, sinceIso),
  ]);

  const stats = seriesStats(metrics, 'ph_before');
  let mlUp = 0;
  let mlDown = 0;

  for (const row of dosages) {
    const ml = asNumber(row.dosage_ml) ?? 0;
    if (ml <= 0) continue;
    const dir = String(row.direction ?? '').toLowerCase();
    if (dir === 'down') mlDown += ml;
    else mlUp += ml;
  }

  return {
    historyMs: stats.historyMs,
    hasFullWindow: stats.historyMs >= GROWER_24H_MIN_SPAN_MS,
    thenValue: stats.thenValue,
    minValue: stats.minValue,
    maxValue: stats.maxValue,
    totalMl: Math.round((mlUp + mlDown) * 10) / 10,
    mlUp: Math.round(mlUp * 10) / 10,
    mlDown: Math.round(mlDown * 10) / 10,
    doseCount: dosages.filter((r) => (asNumber(r.dosage_ml) ?? 0) > 0).length,
  };
}
