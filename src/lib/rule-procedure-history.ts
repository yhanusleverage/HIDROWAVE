/**
 * Historial oficial de procedimientos (Complete/Aborted).
 * Fuente: MQTT procedure_finished → bridge → procedure_events.
 * Distinto de ACK de relé (relay_commands / rule_executed).
 */

import { supabase } from '@/lib/supabase';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import type { AppTranslations } from '@/lib/translations/app/types';

export type ProcedureEventStatus = 'completed' | 'aborted';

export type ProcedureEventRow = {
  id: string;
  device_id: string;
  event_id: string;
  rule_id: string;
  status: ProcedureEventStatus;
  reason: string | null;
  kind: string | null;
  created_at: string;
  /** Nombre humano (bridge lo rellena al INSERT; opcional en filas viejas) */
  rule_name?: string | null;
};

/** UI: bridge/auto-disable completó un procedimiento → refrescar lista de regras */
export const PROCEDURE_FINISHED_UI_EVENT = 'hwProcedureFinished';


export type RuleNameLookup = Record<
  string,
  { rule_name: string | null; rule_json: unknown }
>;

export function displayNameForProcedure(
  row: ProcedureEventRow,
  names: RuleNameLookup,
  t: AppTranslations,
  nameHints?: Record<string, string>
): string {
  const meta = names[row.rule_id];
  const hinted = nameHints?.[row.rule_id]?.trim() || null;
  const name = resolveDecisionRuleDisplayName(
    {
      rule_id: row.rule_id,
      rule_name: hinted ?? meta?.rule_name ?? row.rule_name ?? row.rule_id,
      rule_json: meta?.rule_json,
    },
    t
  );
  if (/^RULE_\d+$/i.test(name)) {
    return hinted || t.automacao.page.executionHistory.unnamedRule;
  }
  return name;
}

/** Notifica a Automação que una regla se completó (enabled=false en UI). */
export function notifyProcedureFinishedUi(input: {
  deviceId: string;
  ruleId: string;
  ruleName?: string | null;
  status: ProcedureEventStatus;
}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PROCEDURE_FINISHED_UI_EVENT, {
      detail: {
        deviceId: input.deviceId,
        ruleId: input.ruleId,
        ruleName: input.ruleName ?? null,
        status: input.status,
      },
    })
  );
}

export async function fetchProcedureEvents(
  deviceId: string,
  limit = 40
): Promise<{ rows: ProcedureEventRow[]; error: string | null; available: boolean }> {
  if (!deviceId || deviceId === 'default_device') {
    return { rows: [], error: null, available: false };
  }

  const { data, error } = await supabase
    .from('procedure_events')
    .select('id, device_id, event_id, rule_id, status, reason, kind, created_at, rule_name')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Columna rule_name aún no migrada — reintentar sin ella
    if (
      error.message?.includes('rule_name') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    ) {
      const fallback = await supabase
        .from('procedure_events')
        .select('id, device_id, event_id, rule_id, status, reason, kind, created_at')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!fallback.error) {
        return {
          rows: (fallback.data ?? []) as ProcedureEventRow[],
          error: null,
          available: true,
        };
      }
    }
    // Tabla aún no migrada — no romper historial ni ocultar ACK
    if (
      error.message?.includes('procedure_events') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    ) {
      return { rows: [], error: null, available: false };
    }
    return { rows: [], error: error.message, available: false };
  }

  return { rows: (data ?? []) as ProcedureEventRow[], error: null, available: true };
}

export function prependProcedureEvent(
  prev: ProcedureEventRow[],
  row: ProcedureEventRow,
  limit = 40
): ProcedureEventRow[] {
  if (prev.some((r) => r.id === row.id || r.event_id === row.event_id)) return prev;
  return [row, ...prev].slice(0, limit);
}

/** rule_id → meta para nombres humanos. */
export async function fetchRuleNameLookup(deviceId: string): Promise<RuleNameLookup> {
  if (!deviceId || deviceId === 'default_device') return {};

  const { data, error } = await supabase
    .from('decision_rules')
    .select('rule_id, rule_name, rule_json')
    .eq('device_id', deviceId)
    .limit(200);

  if (error || !data) return {};

  const out: RuleNameLookup = {};
  for (const row of data as Array<{
    rule_id: string;
    rule_name: string | null;
    rule_json: unknown;
  }>) {
    if (!row.rule_id) continue;
    out[row.rule_id] = {
      rule_name: row.rule_name,
      rule_json: row.rule_json,
    };
  }
  return out;
}

/** True si la regla es procedure (ACK de relé no es éxito oficial). */
export function isProcedureRuleJson(ruleJson: unknown): boolean {
  if (!ruleJson || typeof ruleJson !== 'object') return false;
  const j = ruleJson as Record<string, unknown>;
  if (j.execution_class === 'procedure') return true;
  if (j.execution_class === 'simple') return false;
  const script = j.script as { instructions?: Array<{ type?: string }> } | undefined;
  const instrs = script?.instructions;
  if (!Array.isArray(instrs)) return false;
  return instrs.some(
    (i) =>
      i?.type === 'while' ||
      i?.type === 'wait_level' ||
      i?.type === 'wait_liters' ||
      i?.type === 'recirc' ||
      i?.type === 'block_auto'
  );
}

export function procedureRuleIdsFromLookup(names: RuleNameLookup): Set<string> {
  const ids = new Set<string>();
  for (const [id, meta] of Object.entries(names)) {
    if (isProcedureRuleJson(meta.rule_json)) ids.add(id);
  }
  return ids;
}
