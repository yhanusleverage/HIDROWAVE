import { supabase } from '@/lib/supabase';

export type ScheduleLiveEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx < 0) return [row, ...rows];
  const copy = rows.slice();
  copy[idx] = { ...copy[idx], ...row };
  return copy;
}

export function removeById<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter((r) => r.id !== id);
}

/** Escucha rule_schedules del device. Hace falta la tabla en la publicación supabase_realtime. */
export function subscribeRuleSchedules(
  deviceId: string,
  onChange: (event: ScheduleLiveEvent, row: Record<string, unknown>) => void
): () => void {
  if (!deviceId?.trim() || deviceId === 'default_device') return () => {};
  const id = deviceId.trim();
  const channel = supabase
    .channel(`rule-schedules-${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rule_schedules', filter: `device_id=eq.${id}` },
      (payload) => {
        const event = payload.eventType as ScheduleLiveEvent;
        const row = (event === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;
        if (!row) return;
        onChange(event, row);
      }
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeGrowCycle(
  deviceId: string,
  onChange: () => void,
  slot = 'plans'
): () => void {
  if (!deviceId?.trim() || deviceId === 'default_device') return () => {};
  const id = deviceId.trim();
  const listen = (table: string) => ({
    event: '*' as const,
    schema: 'public',
    table,
    filter: `device_id=eq.${id}`,
  });
  const channel = supabase
    .channel(`grow-cycle-live-${slot}-${id}`)
    .on('postgres_changes', listen('grow_cycle_plans'), () => onChange())
    .on('postgres_changes', listen('grow_cycle_instances'), () => onChange())
    .on('postgres_changes', listen('grow_cycle_weekly_stats'), () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
