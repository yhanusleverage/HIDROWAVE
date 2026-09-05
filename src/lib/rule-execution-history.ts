/**
 * Histórico de execuções DE — filas relay_commands com created_by decision_engine_local#*
 */

import { supabase } from '@/lib/supabase';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import type { AppTranslations } from '@/lib/translations/app/types';

export const DE_CREATED_BY_PREFIX = 'decision_engine_local#';

export type RuleExecutionRow = {
  id: number;
  device_id: string;
  relay_number: number;
  action: string | null;
  status: string;
  created_by: string | null;
  completed_at: string | null;
  created_at?: string | null;
  current_state: boolean | null;
  target_device_id: string | null;
  duration_seconds: number | null;
  error_message: string | null;
};

export function ruleIdFromCreatedBy(createdBy: string | null | undefined): string | null {
  if (!createdBy?.startsWith(DE_CREATED_BY_PREFIX)) return null;
  const id = createdBy.slice(DE_CREATED_BY_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export function displayNameForExecution(
  row: RuleExecutionRow,
  t: AppTranslations
): string {
  const ruleId = ruleIdFromCreatedBy(row.created_by);
  if (!ruleId) return row.created_by ?? '—';
  return resolveDecisionRuleDisplayName({ rule_id: ruleId, rule_name: ruleId }, t);
}

export async function fetchRuleExecutions(
  deviceId: string,
  limit = 20
): Promise<{ rows: RuleExecutionRow[]; error: string | null }> {
  if (!deviceId || deviceId === 'default_device') {
    return { rows: [], error: null };
  }

  const { data, error } = await supabase
    .from('relay_commands')
    .select(
      'id, device_id, relay_number, action, status, created_by, completed_at, created_at, current_state, target_device_id, duration_seconds, error_message'
    )
    .eq('device_id', deviceId)
    .like('created_by', `${DE_CREATED_BY_PREFIX}%`)
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as RuleExecutionRow[], error: null };
}

/** Merge INSERT realtime into list (newest first, cap limit). */
export function prependExecution(
  prev: RuleExecutionRow[],
  row: RuleExecutionRow,
  limit = 20
): RuleExecutionRow[] {
  if (prev.some((r) => r.id === row.id)) return prev;
  return [row, ...prev].slice(0, limit);
}
