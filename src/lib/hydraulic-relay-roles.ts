/**
 * Catálogo fixo de funções hidráulicas P1 — tipagem semântica de relés slave.
 */

import type { ActuatorRef, HydraulicRoleId, ProcedureStep } from '@/lib/rule-procedure/types';
import { slaveRelayKey } from '@/lib/slave-relay-allocation';

export type { HydraulicRoleId };

export interface HydraulicRoleBinding {
  target: 'slave';
  slaveMac: string;
  relayIndex: number;
}

export type HydraulicRolesMap = Partial<Record<HydraulicRoleId, HydraulicRoleBinding>>;

/** MAC tipagem: upper, '-'→':', colapsa '::' residual. */
export function sanitizeSlaveMac(mac: string | null | undefined): string {
  let s = (mac ?? '').trim().toUpperCase().replace(/-/g, ':');
  while (s.includes('::')) {
    s = s.replace(/::/g, ':');
  }
  return s;
}

export interface HydraulicRoleDefinition {
  id: HydraulicRoleId;
  label: string;
  description: string;
  fixedBehavior: string;
  stepTypes: string[];
  required: boolean;
}

export const HYDRAULIC_ROLE_DEFINITIONS: HydraulicRoleDefinition[] = [
  {
    id: 'circulation_pump',
    label: 'Bomba de circulação',
    description: 'Bomba de circulação contínua ou por agendamento P4.',
    fixedBehavior: 'Ligar/desligar relé (set_relay). Não confundir com tempo_recirculacao do Auto EC/pH.',
    stepTypes: ['set_relay'],
    required: true,
  },
  {
    id: 'fill_valve',
    label: 'Válvula de enchimento',
    description: 'Encher tanque até nível alto.',
    fixedBehavior: 'Válvula por sensor até water_level = alto.',
    stepTypes: ['sensor_valve'],
    required: true,
  },
  {
    id: 'drain_valve',
    label: 'Válvula de dreno',
    description: 'Esvaziar tanque até nível vazio.',
    fixedBehavior: 'Válvula por sensor até water_level = vazio.',
    stepTypes: ['sensor_valve'],
    required: true,
  },
  {
    id: 'recharge_pump',
    label: 'Bomba de recarga',
    description: 'Recarga completa após dreno ou troca de solução.',
    fixedBehavior: 'Bomba ou válvula de recarga (opcional).',
    stepTypes: ['sensor_valve', 'set_relay'],
    required: false,
  },
];

export const REQUIRED_HYDRAULIC_ROLES: HydraulicRoleId[] = HYDRAULIC_ROLE_DEFINITIONS.filter(
  (r) => r.required
).map((r) => r.id);

export function getHydraulicRoleDefinition(
  roleId: HydraulicRoleId
): HydraulicRoleDefinition | undefined {
  return HYDRAULIC_ROLE_DEFINITIONS.find((r) => r.id === roleId);
}

export function bindingKey(binding: HydraulicRoleBinding): string {
  return slaveRelayKey({ slaveMac: binding.slaveMac, relayId: binding.relayIndex });
}

export function parseBindingKey(key: string): { slaveMac: string; relayIndex: number } | null {
  const sep = key.lastIndexOf('|');
  if (sep <= 0) return null;
  const slaveMac = key.slice(0, sep);
  const relayIndex = parseInt(key.slice(sep + 1), 10);
  if (!slaveMac || !Number.isFinite(relayIndex)) return null;
  return { slaveMac, relayIndex };
}

export function bindingToActuatorRef(
  binding: HydraulicRoleBinding,
  label?: string
): ActuatorRef {
  return {
    target: 'slave',
    relayIndex: binding.relayIndex,
    slaveMac: binding.slaveMac,
    label,
  };
}

export function resolveActuator(
  roleId: HydraulicRoleId,
  roles: HydraulicRolesMap
): ActuatorRef | null {
  const binding = roles[roleId];
  if (!binding?.slaveMac || binding.relayIndex < 0 || binding.relayIndex > 7) {
    return null;
  }
  const def = getHydraulicRoleDefinition(roleId);
  return bindingToActuatorRef(binding, def?.label);
}

export function validateHydraulicRolesMap(roles: HydraulicRolesMap): string[] {
  const errors: string[] = [];
  const usedKeys = new Map<string, HydraulicRoleId>();

  for (const roleId of REQUIRED_HYDRAULIC_ROLES) {
    const binding = roles[roleId];
    if (!binding?.slaveMac?.trim()) {
      errors.push(`Tipagem obrigatória: ${getHydraulicRoleDefinition(roleId)?.label ?? roleId}`);
      continue;
    }
    if (binding.relayIndex < 0 || binding.relayIndex > 7) {
      errors.push(`${roleId}: relayIndex deve ser 0-7`);
    }
  }

  for (const [roleId, binding] of Object.entries(roles) as [
    HydraulicRoleId,
    HydraulicRoleBinding | undefined,
  ][]) {
    if (!binding?.slaveMac) continue;
    const key = bindingKey(binding);
    const existing = usedKeys.get(key);
    if (existing) {
      errors.push(
        `Relé ${binding.slaveMac} R${binding.relayIndex} já atribuído a ${existing} e ${roleId}`
      );
    } else {
      usedKeys.set(key, roleId);
    }
  }

  return errors;
}

export function rolesUsedByProcedure(steps: ProcedureStep[]): HydraulicRoleId[] {
  const ids = new Set<HydraulicRoleId>();
  for (const step of steps) {
    if ((step.type === 'sensor_valve' || step.type === 'set_relay') && step.roleId) {
      ids.add(step.roleId);
    }
  }
  return [...ids];
}

export function isHydraulicRolesMapCompleteForProcedure(
  roles: HydraulicRolesMap,
  requiredRoleIds: HydraulicRoleId[]
): string[] {
  const errors: string[] = [];
  for (const roleId of requiredRoleIds) {
    if (!roles[roleId]?.slaveMac) {
      errors.push(
        `Configure a tipagem de "${getHydraulicRoleDefinition(roleId)?.label ?? roleId}" antes de guardar`
      );
    }
  }
  return errors;
}

export function normalizeHydraulicRolesJson(raw: unknown): HydraulicRolesMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: HydraulicRolesMap = {};
  for (const def of HYDRAULIC_ROLE_DEFINITIONS) {
    const entry = (raw as Record<string, unknown>)[def.id];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const slaveMac = sanitizeSlaveMac(String(e.slaveMac ?? e.slave_mac ?? ''));
    const relayIndex = Number(e.relayIndex ?? e.relay_index);
    if (slaveMac && Number.isFinite(relayIndex) && relayIndex >= 0 && relayIndex <= 7) {
      out[def.id] = { target: 'slave', slaveMac, relayIndex };
    }
  }
  return out;
}
