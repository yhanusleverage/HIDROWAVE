'use client';

import { FN_RULE_IDS, FN_RULE_NAME_PT } from '@/lib/fixed-function-rule-from-hydraulic';
import type { HydraulicRoleId, ProcedureStep } from '@/lib/rule-procedure/types';
import { HwBadge } from '@/components/ui/HwBadge';
import ConditionFields from '@/components/instruction-editors/ConditionFields';
import { getConditionSensors } from '@/lib/instruction-labels';
import { getHydraulicRoleDefinition } from '@/lib/hydraulic-relay-roles';
import { useLanguage } from '@/contexts/LanguageContext';
import { hydraulicRoleCopy } from '@/lib/translations/app/procedure-roles';

const VALVE_ROLE_IDS: HydraulicRoleId[] = ['fill_valve', 'drain_valve', 'recharge_pump'];
const RELAY_ROLE_IDS: HydraulicRoleId[] = ['circulation_pump', 'recharge_pump'];
const INVOKE_FN_OPTIONS: Array<{ roleId: HydraulicRoleId; ruleId: string }> = [
  { roleId: 'circulation_pump', ruleId: FN_RULE_IDS.circulation_pump },
  { roleId: 'fill_valve', ruleId: FN_RULE_IDS.fill_valve },
  { roleId: 'drain_valve', ruleId: FN_RULE_IDS.drain_valve },
  { roleId: 'recharge_pump', ruleId: FN_RULE_IDS.recharge_pump },
];

interface ProcedureStepEditorProps {
  step: ProcedureStep;
  index: number;
  onChange: (step: ProcedureStep) => void;
  useHydraulicRoles?: boolean;
}

export function ProcedureStepEditor({
  step,
  index,
  onChange,
  useHydraulicRoles = false,
}: ProcedureStepEditorProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const stepTypeLabel =
    step.type === 'sensor_valve'
      ? p.stepSensorValve
      : step.type === 'set_relay'
        ? p.stepSetRelay
        : step.type === 'wait'
          ? p.stepWait
          : step.type === 'hold_chemical'
            ? p.stepHoldChemical
            : p.stepInvokeRule;

  const update = (patch: Partial<ProcedureStep>) => {
    onChange({ ...step, ...patch } as ProcedureStep);
  };

  const setRoleId = (roleId: HydraulicRoleId) => {
    const def = getHydraulicRoleDefinition(roleId);
    if (step.type === 'sensor_valve' || step.type === 'set_relay') {
      onChange({
        ...step,
        roleId,
        actuator: {
          target: 'slave',
          relayIndex: step.actuator.relayIndex,
          slaveMac: step.actuator.slaveMac ?? '',
          label: def?.label,
        },
      });
    }
  };

  return (
    <article className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-dark-textSecondary">
          {p.step.replace('{n}', String(index + 1))}
        </p>
        <HwBadge accent="brand">{stepTypeLabel}</HwBadge>
      </div>

      {'label' in step && (
        <label className="block text-xs">
          <span className="text-dark-textSecondary">{p.stepLabel}</span>
          <input
            type="text"
            value={step.label ?? ''}
            onChange={(e) => update({ label: e.target.value })}
            className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
          />
        </label>
      )}

      {step.type === 'sensor_valve' && (
        <>
          {useHydraulicRoles && (
            <label className="block text-xs">
              <span className="text-dark-textSecondary">{p.hydraulicFunction}</span>
              <select
                value={step.roleId ?? 'fill_valve'}
                onChange={(e) => setRoleId(e.target.value as HydraulicRoleId)}
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
              >
                {VALVE_ROLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {hydraulicRoleCopy(p, id).label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ConditionFields
            label={p.waterCondition}
            condition={{
              sensor: step.sensor.sensor,
              operator: step.sensor.operator,
              value: step.sensor.value,
            }}
            onChange={(condition) =>
              update({
                sensor: {
                  sensor: condition.sensor,
                  operator: condition.operator as typeof step.sensor.operator,
                  value: condition.value,
                },
              })
            }
            sensors={getConditionSensors(t.automacao.instr).filter((s) => s.value === 'water_level')}
          />
          <label className="block text-xs">
            <span className="text-dark-textSecondary">{p.timeoutMin}</span>
            <input
              type="number"
              min={1}
              value={Math.round(step.maxDurationMs / 60000)}
              onChange={(e) =>
                update({ maxDurationMs: Number(e.target.value) * 60000 })
              }
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
            />
          </label>
          {!useHydraulicRoles && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="block">
                  <span className="text-dark-textSecondary">{p.target}</span>
                  <select
                    value={step.actuator.target}
                    onChange={(e) =>
                      update({
                        actuator: {
                          ...step.actuator,
                          target: e.target.value as 'master' | 'slave',
                        },
                      })
                    }
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
                  >
                    <option value="master">HydroWave Core</option>
                    <option value="slave">HydroWave Atlas</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-dark-textSecondary">{p.relay}</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={step.actuator.relayIndex}
                    onChange={(e) =>
                      update({
                        actuator: {
                          ...step.actuator,
                          relayIndex: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
                  />
                </label>
              </div>
              {step.actuator.target === 'slave' && (
                <label className="block text-xs">
                  <span className="text-dark-textSecondary">{p.atlasMac}</span>
                  <input
                    type="text"
                    value={step.actuator.slaveMac ?? ''}
                    onChange={(e) =>
                      update({
                        actuator: { ...step.actuator, slaveMac: e.target.value },
                      })
                    }
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded font-mono"
                  />
                </label>
              )}
            </>
          )}
        </>
      )}

      {step.type === 'set_relay' && (
        <>
          {useHydraulicRoles && (
            <label className="block text-xs">
              <span className="text-dark-textSecondary">{p.hydraulicFunction}</span>
              <select
                value={step.roleId ?? 'circulation_pump'}
                onChange={(e) => setRoleId(e.target.value as HydraulicRoleId)}
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
              >
                {RELAY_ROLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {hydraulicRoleCopy(p, id).label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={`grid gap-2 text-xs ${useHydraulicRoles ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <label className="block">
              <span className="text-dark-textSecondary">{p.state}</span>
              <select
                value={step.state}
                onChange={(e) =>
                  update({ state: e.target.value as 'on' | 'off' })
                }
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
              >
                <option value="on">ON</option>
                <option value="off">OFF</option>
              </select>
            </label>
            {!useHydraulicRoles && (
              <>
                <label className="block">
                  <span className="text-dark-textSecondary">{p.target}</span>
                  <select
                    value={step.actuator.target}
                    onChange={(e) =>
                      update({
                        actuator: {
                          ...step.actuator,
                          target: e.target.value as 'master' | 'slave',
                        },
                      })
                    }
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
                  >
                    <option value="master">HydroWave Core</option>
                    <option value="slave">HydroWave Atlas</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-dark-textSecondary">{p.relay}</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={step.actuator.relayIndex}
                    onChange={(e) =>
                      update({
                        actuator: {
                          ...step.actuator,
                          relayIndex: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
                  />
                </label>
              </>
            )}
          </div>
          {!useHydraulicRoles && step.actuator.target === 'slave' && (
            <label className="block text-xs">
              <span className="text-dark-textSecondary">{p.atlasMac}</span>
              <input
                type="text"
                value={step.actuator.slaveMac ?? ''}
                onChange={(e) =>
                  update({
                    actuator: { ...step.actuator, slaveMac: e.target.value },
                  })
                }
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded font-mono"
              />
            </label>
          )}
        </>
      )}

      {step.type === 'wait' && (
        <label className="block text-xs">
          <span className="text-dark-textSecondary">{p.durationSec}</span>
          <input
            type="number"
            min={1}
            value={Math.round(step.durationMs / 1000)}
            onChange={(e) => update({ durationMs: Number(e.target.value) * 1000 })}
            className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
          />
        </label>
      )}

      {step.type === 'invoke_rule' && (
        <div className="space-y-2 text-xs">
          <label className="block">
            <span className="text-dark-textSecondary">{p.stepInvokeRule}</span>
            <select
              value={step.targetRuleId}
              onChange={(e) => update({ targetRuleId: e.target.value })}
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
            >
              {INVOKE_FN_OPTIONS.map(({ roleId, ruleId }) => (
                <option key={ruleId} value={ruleId}>
                  {hydraulicRoleCopy(p, roleId).label} ({ruleId})
                </option>
              ))}
              <option value={step.targetRuleId}>
                {step.targetRuleId || '— custom —'}
              </option>
            </select>
          </label>
          <p className="text-[11px] text-dark-textSecondary/90">
            {FN_RULE_NAME_PT[
              (Object.entries(FN_RULE_IDS).find(([, id]) => id === step.targetRuleId)?.[0] as
                | HydraulicRoleId
                | undefined) ?? 'circulation_pump'
            ] ?? step.targetRuleId}
          </p>
          <label className="block">
            <span className="text-dark-textSecondary">on</span>
            <select
              value={step.on}
              onChange={(e) =>
                update({ on: e.target.value as 'success' | 'failure' })
              }
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
            >
              <option value="success">success</option>
              <option value="failure">failure</option>
            </select>
          </label>
        </div>
      )}
    </article>
  );
}
