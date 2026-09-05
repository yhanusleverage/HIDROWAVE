import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import { validateGrowCyclePlan } from '@/lib/grow-cycle-plans/validate-grow-plan';
import {
  createGrowCycleInstance,
  createGrowCyclePlan,
  updateGrowCyclePlan,
} from '@/lib/grow-cycle-plans/grow-cycle-plans-server';
import { buildProceduresFromGrowPlan } from '@/lib/rule-procedure/publish-from-timeline';
import { saveProcedureToDecisionRulesServer } from '@/lib/rule-procedure/save-procedure-server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { syncGrowCycleSchedulesFromPlan } from '@/lib/grow-cycle-plans/sync-grow-schedules';

export interface PublishGrowPlanInput {
  deviceId: string;
  plan: GrowCyclePlan;
  planRowId?: string;
  createdBy?: string;
}

export interface PublishGrowPlanResult {
  ok: boolean;
  errors: string[];
  planId?: string;
  instanceId?: string;
  rulesCreated: number;
  rulesUpdated: number;
  schedulesUpserted?: number;
}

async function applyWeekZeroSetpoints(deviceId: string, plan: GrowCyclePlan): Promise<string[]> {
  const warnings: string[] = [];
  const week0 = plan.weeks.find((w) => w.weekIndex === 0);
  if (!week0) return warnings;

  const sb = getSupabaseServerClient();

  const { error: ecErr } = await sb.from('ec_controller_config').upsert(
    {
      device_id: deviceId,
      ec_setpoint: week0.ecSetpointUsCm,
      volume: week0.tankVolumeL ?? 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  );
  if (ecErr) warnings.push(`EC setpoint: ${ecErr.message}`);

  const { error: phErr } = await sb.from('ph_controller_config').upsert(
    {
      device_id: deviceId,
      ph_setpoint: week0.phSetpoint,
      volume: week0.tankVolumeL ?? 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  );
  if (phErr) warnings.push(`pH setpoint: ${phErr.message}`);

  return warnings;
}

/**
 * Iniciar ciclo: plan + instance S0 + schedules primero.
 * Regras P1/P4 são best-effort (avisos) — não bloqueiam o arranque.
 */
export async function publishGrowCyclePlan(
  input: PublishGrowPlanInput
): Promise<PublishGrowPlanResult> {
  const validation = validateGrowCyclePlan(input.plan);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, rulesCreated: 0, rulesUpdated: 0 };
  }

  const deviceId = input.deviceId.trim();
  let planId = input.planRowId;
  const warnings: string[] = [];
  let rulesCreated = 0;
  let rulesUpdated = 0;

  try {
    if (planId) {
      await updateGrowCyclePlan(planId, {
        planJson: input.plan,
        totalWeeks: input.plan.totalWeeks,
        name: input.plan.name,
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
    } else {
      const row = await createGrowCyclePlan({
        deviceId,
        name: input.plan.name,
        totalWeeks: input.plan.totalWeeks,
        planJson: input.plan,
        status: 'published',
      });
      planId = row.id;
      await updateGrowCyclePlan(planId, {
        publishedAt: new Date().toISOString(),
      });
    }

    const instance = await createGrowCycleInstance({
      planId: planId!,
      deviceId,
      currentWeekIndex: 0,
    });

    const setpointWarnings = await applyWeekZeroSetpoints(deviceId, input.plan);
    warnings.push(...setpointWarnings);

    const sched = await syncGrowCycleSchedulesFromPlan(deviceId, input.plan);
    warnings.push(...sched.warnings);

    const procedures = buildProceduresFromGrowPlan(input.plan);
    for (const proc of procedures) {
      try {
        const result = await saveProcedureToDecisionRulesServer(
          deviceId,
          proc,
          input.createdBy ?? 'grow-cycle-publish',
          { skipMqtt: true }
        );
        if (!result.ok) {
          warnings.push(`${proc.id}: ${result.error}`);
          continue;
        }
        if (result.created) rulesCreated++;
        else rulesUpdated++;
      } catch (e) {
        warnings.push(
          `${proc.id}: ${e instanceof Error ? e.message : 'erro ao guardar regra'}`
        );
      }
    }

    // Um único manifest MQTT no fim (evita hang de N publishes)
    try {
      const sb = getSupabaseServerClient();
      const { data: rows } = await sb
        .from('decision_rules')
        .select('rule_id, rule_name, rule_description, rule_json, enabled, priority')
        .eq('device_id', deviceId);
      if (rows?.length) {
        const { notifyDeviceRulesManifest, hashRulePayload } = await import(
          '@/lib/mqtt-rules-publish'
        );
        await notifyDeviceRulesManifest(
          deviceId,
          rows.map((r) => ({
            rule_id: String(r.rule_id),
            hash: hashRulePayload({
              rule_id: r.rule_id,
              rule_name: r.rule_name,
              rule_description: r.rule_description,
              enabled: Boolean(r.enabled),
              priority: r.priority ?? 50,
              rule_json: r.rule_json ?? {},
            }),
            enabled: Boolean(r.enabled),
          }))
        );
      }
    } catch (e) {
      warnings.push(
        `MQTT manifest: ${e instanceof Error ? e.message : 'falhou (ciclo já activo)'}`
      );
    }

    return {
      ok: true,
      errors: warnings,
      planId,
      instanceId: instance.id,
      rulesCreated,
      rulesUpdated,
      schedulesUpserted: sched.upserted,
    };
  } catch (e) {
    return {
      ok: false,
      errors: [e instanceof Error ? e.message : 'Erro ao iniciar ciclo'],
      planId,
      rulesCreated,
      rulesUpdated,
    };
  }
}
