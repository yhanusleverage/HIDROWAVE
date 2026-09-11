/**
 * Auditoría de activar/desactivar regras (config), distinto do espelho DE (relay_commands).
 * Tenta Supabase `rule_config_events`; se a tabela não existir, usa localStorage.
 */

import { supabase } from '@/lib/supabase';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import type { AppTranslations } from '@/lib/translations/app/types';

export type RuleConfigEventType = 'enabled' | 'disabled';

export type RuleConfigEvent = {
  id: string;
  device_id: string;
  rule_id: string;
  rule_name: string | null;
  event_type: RuleConfigEventType;
  created_at: string;
};

const LS_PREFIX = 'hw_rule_config_events:';
export const RULE_CONFIG_HISTORY_EVENT = 'ruleConfigHistoryUpdated';

function lsKey(deviceId: string): string {
  return `${LS_PREFIX}${deviceId}`;
}

function readLocal(deviceId: string): RuleConfigEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(lsKey(deviceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RuleConfigEvent[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(deviceId: string, events: RuleConfigEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lsKey(deviceId), JSON.stringify(events.slice(0, 100)));
  } catch {
    /* quota */
  }
}

function notify(deviceId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RULE_CONFIG_HISTORY_EVENT, { detail: { deviceId } })
  );
}

export function displayNameForConfigEvent(
  event: RuleConfigEvent,
  t: AppTranslations
): string {
  return resolveDecisionRuleDisplayName(
    { rule_id: event.rule_id, rule_name: event.rule_name ?? event.rule_id },
    t
  );
}

export async function appendRuleConfigEvent(input: {
  deviceId: string;
  ruleId: string;
  ruleName?: string | null;
  enabled: boolean;
}): Promise<RuleConfigEvent | null> {
  const { deviceId, ruleId, ruleName, enabled } = input;
  if (!deviceId?.trim() || deviceId === 'default_device' || !ruleId?.trim()) {
    return null;
  }

  const event: RuleConfigEvent = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    device_id: deviceId,
    rule_id: ruleId,
    rule_name: ruleName?.trim() || null,
    event_type: enabled ? 'enabled' : 'disabled',
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('rule_config_events').insert({
    id: event.id,
    device_id: event.device_id,
    rule_id: event.rule_id,
    rule_name: event.rule_name,
    event_type: event.event_type,
    created_at: event.created_at,
  });

  if (error) {
    // Tabela ainda não migrada / RLS — fallback local (não quebra o toggle)
    const prev = readLocal(deviceId);
    writeLocal(deviceId, [event, ...prev]);
  }

  notify(deviceId);
  return event;
}

export async function fetchRuleConfigEvents(
  deviceId: string,
  limit = 40
): Promise<RuleConfigEvent[]> {
  if (!deviceId?.trim() || deviceId === 'default_device') return [];

  const { data, error } = await supabase
    .from('rule_config_events')
    .select('id, device_id, rule_id, rule_name, event_type, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!error && Array.isArray(data) && data.length > 0) {
    return data as RuleConfigEvent[];
  }

  return readLocal(deviceId).slice(0, limit);
}
