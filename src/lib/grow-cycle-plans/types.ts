import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';

export type GrowCyclePlanStatus = 'draft' | 'published' | 'archived';

export interface GrowCyclePlanRow {
  id: string;
  device_id: string;
  name: string;
  total_weeks: number;
  plan_json: GrowCyclePlan;
  status: GrowCyclePlanStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowCycleInstanceRow {
  id: string;
  plan_id: string | null;
  device_id: string;
  started_at: string;
  current_week_index: number;
  ended_at: string | null;
}

export interface GrowCycleWeeklyStatsRow {
  id: number;
  instance_id: string;
  device_id: string;
  week_index: number;
  phase: string | null;
  ec_setpoint: number | null;
  ec_avg: number | null;
  ec_min: number | null;
  ec_max: number | null;
  ph_setpoint: number | null;
  ph_avg: number | null;
  tank_events_executed: unknown;
  dosages_summary: unknown;
  computed_at: string;
}

export interface HydroHourlyRow {
  device_id: string;
  bucket_start: string;
  ec_avg: number | null;
  ec_min: number | null;
  ec_max: number | null;
  ph_avg: number | null;
  temp_avg: number | null;
  sample_count: number;
}

export interface HydroDailyRow {
  device_id: string;
  day: string;
  ec_avg: number | null;
  ph_avg: number | null;
  temp_avg: number | null;
  sample_count: number;
}
