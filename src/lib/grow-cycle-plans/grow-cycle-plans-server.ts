import { getSupabaseServerClient } from '@/lib/supabase-server';
import { isSupabaseMissingTableError } from '@/lib/db-schema';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import type {
  GrowCycleInstanceRow,
  GrowCyclePlanRow,
  GrowCyclePlanStatus,
  GrowCycleWeeklyStatsRow,
  HydroDailyRow,
  HydroHourlyRow,
} from './types';

function rowToPlan(row: GrowCyclePlanRow): GrowCyclePlanRow {
  return {
    ...row,
    plan_json: row.plan_json as GrowCyclePlan,
  };
}

export async function listGrowCyclePlans(
  deviceId: string,
  status?: GrowCyclePlanStatus
): Promise<{ plans: GrowCyclePlanRow[]; tableAvailable: boolean }> {
  const sb = getSupabaseServerClient();
  let q = sb
    .from('grow_cycle_plans')
    .select('*')
    .eq('device_id', deviceId.trim())
    .order('updated_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { plans: [], tableAvailable: false };
    }
    throw error;
  }

  return {
    plans: (data ?? []).map((r) => rowToPlan(r as GrowCyclePlanRow)),
    tableAvailable: true,
  };
}

export async function getGrowCyclePlanById(id: string): Promise<GrowCyclePlanRow | null> {
  const sb = getSupabaseServerClient();
  const { data, error } = await sb.from('grow_cycle_plans').select('*').eq('id', id).maybeSingle();
  if (error) {
    if (isSupabaseMissingTableError(error)) return null;
    throw error;
  }
  return data ? rowToPlan(data as GrowCyclePlanRow) : null;
}

export async function createGrowCyclePlan(input: {
  deviceId: string;
  name: string;
  totalWeeks: number;
  planJson: GrowCyclePlan;
  status?: GrowCyclePlanStatus;
}): Promise<GrowCyclePlanRow> {
  const sb = getSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('grow_cycle_plans')
    .insert({
      device_id: input.deviceId.trim(),
      name: input.name.trim(),
      total_weeks: input.totalWeeks,
      plan_json: input.planJson,
      status: input.status ?? 'draft',
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToPlan(data as GrowCyclePlanRow);
}

export async function updateGrowCyclePlan(
  id: string,
  patch: Partial<{
    name: string;
    totalWeeks: number;
    planJson: GrowCyclePlan;
    status: GrowCyclePlanStatus;
    publishedAt: string | null;
  }>
): Promise<GrowCyclePlanRow> {
  const sb = getSupabaseServerClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) row.name = patch.name;
  if (patch.totalWeeks != null) row.total_weeks = patch.totalWeeks;
  if (patch.planJson != null) row.plan_json = patch.planJson;
  if (patch.status != null) row.status = patch.status;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;

  const { data, error } = await sb
    .from('grow_cycle_plans')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return rowToPlan(data as GrowCyclePlanRow);
}

export async function deleteGrowCyclePlan(id: string): Promise<void> {
  const sb = getSupabaseServerClient();
  const { error } = await sb.from('grow_cycle_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function getActiveGrowCycleInstance(
  deviceId: string
): Promise<GrowCycleInstanceRow | null> {
  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from('grow_cycle_instances')
    .select('*')
    .eq('device_id', deviceId.trim())
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return null;
    throw error;
  }
  return (data as GrowCycleInstanceRow) ?? null;
}

export async function createGrowCycleInstance(input: {
  planId: string;
  deviceId: string;
  currentWeekIndex?: number;
}): Promise<GrowCycleInstanceRow> {
  const sb = getSupabaseServerClient();

  await sb
    .from('grow_cycle_instances')
    .update({ ended_at: new Date().toISOString() })
    .eq('device_id', input.deviceId.trim())
    .is('ended_at', null);

  const { data, error } = await sb
    .from('grow_cycle_instances')
    .insert({
      plan_id: input.planId,
      device_id: input.deviceId.trim(),
      current_week_index: input.currentWeekIndex ?? 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as GrowCycleInstanceRow;
}

export async function listWeeklyStats(
  deviceId: string,
  instanceId?: string
): Promise<GrowCycleWeeklyStatsRow[]> {
  const sb = getSupabaseServerClient();
  let q = sb
    .from('grow_cycle_weekly_stats')
    .select('*')
    .eq('device_id', deviceId.trim())
    .order('week_index', { ascending: true });

  if (instanceId) q = q.eq('instance_id', instanceId);

  const { data, error } = await q;
  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as GrowCycleWeeklyStatsRow[];
}

export async function fetchHydroHourly(
  deviceId: string,
  hours = 24
): Promise<HydroHourlyRow[]> {
  const sb = getSupabaseServerClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('hydro_measurements_hourly')
    .select('*')
    .eq('device_id', deviceId.trim())
    .gte('bucket_start', since)
    .order('bucket_start', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as HydroHourlyRow[];
}

export async function fetchHydroDaily(
  deviceId: string,
  days = 90
): Promise<HydroDailyRow[]> {
  const sb = getSupabaseServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('hydro_measurements_daily')
    .select('*')
    .eq('device_id', deviceId.trim())
    .gte('day', since)
    .order('day', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as HydroDailyRow[];
}
