/**
 * Recompila rule_json de procedimento.
 * Tipagem P1 = só recirculação; dreno/fill herdam MAC do slave da circulação se faltar.
 * Nunca bloqueia o sync (fallback ao rule_json original).
 */
import { getHydraulicRolesForDevice } from '@/lib/hydraulic-roles-server';
import type { RuleProcedure, ProcedureStep } from './types';
import {
  compileProcedureToPayload,
  materializeProcedureHydraulicRoles,
} from './compile-procedure';
import type { HydraulicRolesMap } from '@/lib/hydraulic-relay-roles';

function asProcedure(
  ruleId: string,
  ruleName: string | undefined,
  ruleJson: Record<string, unknown>
): RuleProcedure | null {
  const canonical = ruleJson.procedure_canonical;
  if (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) {
    const p = canonical as RuleProcedure;
    if (Array.isArray(p.steps) && p.steps.length > 0) {
      return {
        ...p,
        id: p.id || ruleId,
        name: p.name || ruleName || ruleId,
      };
    }
  }

  const steps = ruleJson.procedure_steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }

  const triggers = (ruleJson.procedure_triggers as RuleProcedure['triggers']) ?? [];
  const ref = ruleJson.procedure_ref as { id?: string; layer?: RuleProcedure['layer'] } | undefined;

  return {
    id: ruleId,
    name: ruleName || ruleId,
    description: '',
    priority: typeof ruleJson.priority === 'number' ? ruleJson.priority : 50,
    layer: ref?.layer ?? 'P1',
    enabled: true,
    triggers,
    steps: steps as ProcedureStep[],
  };
}

/** Só recirculação entra na rematerialização por tipagem. */
function circulationRolesOnly(roles: HydraulicRolesMap): HydraulicRolesMap {
  if (!roles.circulation_pump) return {};
  return { circulation_pump: roles.circulation_pump };
}

/**
 * Se for procedimento com steps/canonical, rematerializa (circ tipagem) e recompila.
 * Em qualquer falha devolve o original — não impede ativar no Core.
 */
export async function rematerializeRuleJsonForDevice(
  deviceId: string,
  ruleId: string,
  ruleName: string | undefined,
  ruleJson: unknown
): Promise<{ ok: true; ruleJson: Record<string, unknown> } | { ok: false; error: string }> {
  if (!ruleJson || typeof ruleJson !== 'object' || Array.isArray(ruleJson)) {
    return { ok: true, ruleJson: {} };
  }

  const src = ruleJson as Record<string, unknown>;
  const procedure = asProcedure(ruleId, ruleName, src);
  if (!procedure) {
    return { ok: true, ruleJson: src };
  }

  let roles: HydraulicRolesMap = {};
  const rolesResult = await getHydraulicRolesForDevice(deviceId);
  if (rolesResult.ok) {
    roles = circulationRolesOnly(rolesResult.roles);
  }

  try {
    const materialized = materializeProcedureHydraulicRoles(procedure, roles);
    // Erros de circulação: ainda tenta compilar com o que houver; não 422
    if (materialized.errors.length > 0) {
      console.warn(
        `[rematerialize] ${ruleId}: ${materialized.errors.join('; ')} — continua`
      );
    }

    // Já materializado — compilar sem re-aplicar tipagem (evita throw)
    const payload = compileProcedureToPayload(materialized.procedure);
    return {
      ok: true,
      ruleJson: {
        ...payload.rule_json,
        procedure_triggers: procedure.triggers,
        procedure_canonical: materialized.procedure,
      },
    };
  } catch (e) {
    console.warn(
      `[rematerialize] ${ruleId} fallback original:`,
      e instanceof Error ? e.message : e
    );
    return { ok: true, ruleJson: src };
  }
}
