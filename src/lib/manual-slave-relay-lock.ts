/**
 * Mapa MAC-relay → bloqueio no Acionamento manual rápido.
 * Relé sob regra ativa ou tipagem de circulação durante ciclo Auto EC/pH.
 */

import {
  FN_RULE_IDS,
  roleIdFromFnRuleId,
} from '@/lib/fixed-function-rule-from-hydraulic';
import {
  sanitizeSlaveMac,
  type HydraulicRoleId,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import { isEcCycleActive, isPhCycleActive } from '@/lib/relay-naming-lock';

export type ManualSlaveRelayLockReason = 'rule' | 'auto_ec_cycle' | 'auto_ph_cycle';

export type ManualSlaveRelayLock = {
  reason: ManualSlaveRelayLockReason;
  /** Nome curto para badge/tooltip */
  label: string;
  ruleId?: string;
};

/** Chave estável: MAC sanitizado + relay. */
export function manualSlaveRelayKey(mac: string, relayId: number): string {
  return `${sanitizeSlaveMac(mac)}-${relayId}`;
}

type RuleLike = {
  enabled?: boolean;
  rule_id?: string;
  rule_name?: string;
  name?: string;
  actions?: Array<Record<string, unknown>>;
  rule_json?: Record<string, unknown> | null;
};

function setLock(
  map: Map<string, ManualSlaveRelayLock>,
  mac: string,
  relayId: number,
  lock: ManualSlaveRelayLock
) {
  if (!mac || !Number.isFinite(relayId) || relayId < 0 || relayId > 7) return;
  const key = manualSlaveRelayKey(mac, relayId);
  const prev = map.get(key);
  // Auto cycle prevalece sobre “só regra” (tooltip mais específico no dose/recirc)
  if (prev && prev.reason !== 'rule' && lock.reason === 'rule') return;
  map.set(key, lock);
}

function extractMacRelayFromAction(action: Record<string, unknown>): {
  mac: string;
  relay: number;
} | null {
  const macRaw =
    (action.target_device_id as string) ||
    (action.slave_mac_address as string) ||
    (action.slave_mac as string) ||
    '';
  const mac = sanitizeSlaveMac(macRaw);
  if (!mac || mac === 'LOCAL' || mac === 'MASTER') return null;

  let relay = Number(
    action.target_relay ?? action.relay_number ?? action.relay_id ?? NaN
  );
  if (!Number.isFinite(relay) && Array.isArray(action.relay_ids) && action.relay_ids.length > 0) {
    relay = Number(action.relay_ids[0]);
  }
  if (!Number.isFinite(relay) || relay < 0 || relay > 7) return null;
  return { mac, relay };
}

/**
 * `actions: []` é truthy — não usar `||`. Preferir array com itens.
 */
function resolveRuleActions(rule: RuleLike): Array<Record<string, unknown>> {
  const top = Array.isArray(rule.actions) ? rule.actions : [];
  if (top.length > 0) return top;
  const fromJson = rule.rule_json?.actions;
  if (Array.isArray(fromJson) && fromJson.length > 0) {
    return fromJson as Array<Record<string, unknown>>;
  }
  return [];
}

function walkScriptInstructions(
  instructions: unknown,
  visit: (action: Record<string, unknown>) => void
) {
  if (!Array.isArray(instructions)) return;
  for (const raw of instructions) {
    if (!raw || typeof raw !== 'object') continue;
    const instr = raw as Record<string, unknown>;
    const type = String(instr.type || '').toLowerCase();
    if (type === 'relay_action' || type === 'set_relay' || type === 'relay_on' || type === 'relay_off') {
      visit(instr);
    }
    if (instr.body) walkScriptInstructions(instr.body, visit);
    if (instr.then) walkScriptInstructions(instr.then, visit);
    if (instr.else) walkScriptInstructions(instr.else, visit);
    if (Array.isArray(instr.instructions)) {
      walkScriptInstructions(instr.instructions, visit);
    }
  }
}

function bindingFromTipagem(
  roles: HydraulicRolesMap | null | undefined,
  roleId: HydraulicRoleId
): { mac: string; relay: number } | null {
  const b = roles?.[roleId];
  if (!b?.slaveMac) return null;
  const mac = sanitizeSlaveMac(b.slaveMac);
  const relay = Number(b.relayIndex);
  if (!mac || !Number.isFinite(relay) || relay < 0 || relay > 7) return null;
  return { mac, relay };
}

/** Extrai (mac, relay) de uma regra enabled (actions + script + tipagem fn_*). */
export function collectSlaveRelaysFromRule(
  rule: RuleLike,
  hydraulicRoles?: HydraulicRolesMap | null
): Array<{ mac: string; relay: number }> {
  const out: Array<{ mac: string; relay: number }> = [];
  const seen = new Set<string>();

  const add = (mac: string, relay: number) => {
    const k = manualSlaveRelayKey(mac, relay);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ mac, relay });
  };

  for (const a of resolveRuleActions(rule)) {
    if (!a || typeof a !== 'object') continue;
    const hit = extractMacRelayFromAction(a);
    if (hit) add(hit.mac, hit.relay);
  }

  const script = rule.rule_json?.script as { instructions?: unknown } | undefined;
  walkScriptInstructions(script?.instructions, (instr) => {
    const hit = extractMacRelayFromAction({
      ...instr,
      target_device_id: instr.slave_mac || instr.target_device_id,
      target_relay: instr.relay_number ?? instr.target_relay,
    });
    if (hit) add(hit.mac, hit.relay);
  });

  // Macros fn_*: se actions vazias / só tipagem, trava via hydraulic_roles
  if (out.length === 0 && rule.rule_id) {
    const roleId = roleIdFromFnRuleId(rule.rule_id);
    if (roleId) {
      const hit = bindingFromTipagem(hydraulicRoles, roleId);
      if (hit) add(hit.mac, hit.relay);
    }
  }

  return out;
}

export function buildManualSlaveRelayLockMap(input: {
  rules: RuleLike[];
  hydraulicRoles?: HydraulicRolesMap | null;
  ecCycleActive: boolean;
  phCycleActive: boolean;
}): Map<string, ManualSlaveRelayLock> {
  const map = new Map<string, ManualSlaveRelayLock>();

  for (const rule of input.rules) {
    if (!rule.enabled) continue;
    const label =
      (rule.rule_name || rule.name || rule.rule_id || 'regra').toString().trim() || 'regra';
    for (const { mac, relay } of collectSlaveRelaysFromRule(rule, input.hydraulicRoles)) {
      setLock(map, mac, relay, {
        reason: 'rule',
        label,
        ruleId: rule.rule_id,
      });
    }
  }

  const circ = input.hydraulicRoles?.circulation_pump;
  if (circ?.slaveMac && circ.relayIndex >= 0) {
    if (input.ecCycleActive) {
      setLock(map, circ.slaveMac, circ.relayIndex, {
        reason: 'auto_ec_cycle',
        label: 'Auto EC',
        ruleId: FN_RULE_IDS.circulation_pump,
      });
    }
    if (input.phCycleActive) {
      setLock(map, circ.slaveMac, circ.relayIndex, {
        reason: 'auto_ph_cycle',
        label: 'Auto pH',
        ruleId: FN_RULE_IDS.circulation_pump,
      });
    }
  }

  return map;
}

export function isManualSlaveRelayLocked(
  map: Map<string, ManualSlaveRelayLock>,
  mac: string,
  relayId: number
): ManualSlaveRelayLock | undefined {
  return map.get(manualSlaveRelayKey(mac, relayId));
}

export { isEcCycleActive, isPhCycleActive };
