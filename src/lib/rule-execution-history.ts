/**
 * Histórico de execuções DE — filas relay_commands com created_by decision_engine_local#*
 *
 * UX: colapsa keepalive (mesma regra + relé + estado) — recirculação contínua
 * não deve gerar uma linha por minuto.
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

/** Linha para UI após colapsar ticks iguais. */
export type RuleExecutionDisplayRow = RuleExecutionRow & {
  /** Quantas confirmações iguais foram fundidas (inclui esta). Só interno. */
  collapsedCount: number;
  /** Início do tramo (primeiro Ligou/Desligou), não o último keepalive. */
  startedAt: string;
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
  const name = resolveDecisionRuleDisplayName(
    { rule_id: ruleId, rule_name: ruleId },
    t
  );
  // Evita mostrar RULE_<timestamp> cru na UI
  if (/^RULE_\d+$/i.test(name)) {
    return t.automacao.page.executionHistory.unnamedRule;
  }
  return name;
}

function rowWhen(row: RuleExecutionRow): string {
  return row.completed_at ?? row.created_at ?? '';
}

function stateKey(row: RuleExecutionRow): string {
  const ruleId = ruleIdFromCreatedBy(row.created_by) ?? row.created_by ?? '';
  const action = (row.action ?? '').toLowerCase();
  const state =
    row.current_state === true ? '1' : row.current_state === false ? '0' : 'x';
  const ok = row.status === 'completed' ? 'ok' : row.status === 'failed' ? 'fail' : row.status;
  return `${ruleId}|${row.relay_number}|${action}|${state}|${ok}|${row.target_device_id ?? ''}`;
}

/**
 * Entrada newest-first: funde sequências iguais (keepalive ON).
 * Timestamp da UI = início do tramo (tick mais antigo), para não “subir” a cada minuto.
 */
export function collapseKeepaliveExecutions(
  rows: RuleExecutionRow[]
): RuleExecutionDisplayRow[] {
  if (rows.length === 0) return [];
  const out: RuleExecutionDisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const newest = rows[i];
    const key = stateKey(newest);
    let count = 1;
    let j = i + 1;
    while (j < rows.length && stateKey(rows[j]) === key) {
      count += 1;
      j += 1;
    }
    const oldest = rows[j - 1];
    const startedAt = rowWhen(oldest) || rowWhen(newest);
    out.push({
      ...newest,
      completed_at: oldest.completed_at ?? newest.completed_at,
      created_at: oldest.created_at ?? newest.created_at,
      collapsedCount: count,
      startedAt,
    });
    i = j;
  }
  return out;
}

export async function fetchRuleExecutions(
  deviceId: string,
  limit = 20
): Promise<{ rows: RuleExecutionRow[]; error: string | null }> {
  if (!deviceId || deviceId === 'default_device') {
    return { rows: [], error: null };
  }

  const fetchLimit = Math.min(Math.max(limit * 5, 40), 100);

  const { data, error } = await supabase
    .from('relay_commands')
    .select(
      'id, device_id, relay_number, action, status, created_by, completed_at, created_at, current_state, target_device_id, duration_seconds, error_message'
    )
    .eq('device_id', deviceId)
    .like('created_by', `${DE_CREATED_BY_PREFIX}%`)
    .order('id', { ascending: false })
    .limit(fetchLimit);

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
