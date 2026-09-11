'use client';

import type { ReactNode } from 'react';
import { FN_RULE_IDS, FN_RULE_NAME_PT } from '@/lib/fixed-function-rule-from-hydraulic';
import type { ActuatorRef, HydraulicRoleId, ProcedureStep } from '@/lib/rule-procedure/types';
import { HwBadge } from '@/components/ui/HwBadge';
import ConditionFields from '@/components/instruction-editors/ConditionFields';
import { getConditionSensors } from '@/lib/instruction-labels';
import { getHydraulicRoleDefinition } from '@/lib/hydraulic-relay-roles';
import { useLanguage } from '@/contexts/LanguageContext';
import { hydraulicRoleCopy } from '@/lib/translations/app/procedure-roles';
import type { ActuatorRelayOption } from '@/lib/actuator-relay-options';
import { ActuatorRelaySelect } from '@/components/rule-procedure/ActuatorRelaySelect';
import type { DosingPumpOption } from '@/lib/dosing-pump-options';
import {
  calculateDoseDurationSeconds,
  doseDurationSecondsForRelay,
  formatDoseDurationSeconds,
} from '@/lib/pump-calibration';
import { useEffect, useMemo } from 'react';

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
  headerActions?: ReactNode;
  /** Mesma lista Core+Atlas das ações simples (optgroup) */
  actuatorOptions?: ActuatorRelayOption[];
  /** Bombas Core com flowRate — se o relé estiver aqui, UI em ml */
  dosingPumps?: DosingPumpOption[];
}

export function ProcedureStepEditor({
  step,
  index,
  onChange,
  useHydraulicRoles = false,
  headerActions,
  actuatorOptions = [],
  dosingPumps = [],
}: ProcedureStepEditorProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const instrT = t.automacao.instr;
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

  const dosingByRelay = useMemo(() => {
    const map = new Map<number, DosingPumpOption>();
    for (const pump of dosingPumps) {
      map.set(pump.relayNumber, pump);
    }
    return map;
  }, [dosingPumps]);

  const dosingPumpForStep =
    step.type === 'set_relay' && step.actuator.target === 'master'
      ? dosingByRelay.get(step.actuator.relayIndex) ?? null
      : null;

  /** Quando as bombas calibradas chegam depois da seleção, ativa dose ml. */
  useEffect(() => {
    if (step.type !== 'set_relay' || !dosingPumpForStep) return;
    if (step.dosageMl != null && step.dosageMl > 0) return;
    const ml = 20;
    const raw = calculateDoseDurationSeconds(ml, dosingPumpForStep.flowRate);
    onChange({
      ...step,
      state: 'on',
      dosageMl: ml,
      durationSeconds: raw != null ? doseDurationSecondsForRelay(raw) : 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dosingPumpForStep?.relayNumber, dosingPumpForStep?.flowRate]);

  const update = (patch: Partial<ProcedureStep>) => {
    onChange({ ...step, ...patch } as ProcedureStep);
  };

  const setActuator = (actuator: ActuatorRef) => {
    if (step.type === 'sensor_valve') {
      onChange({ ...step, actuator });
      return;
    }
    if (step.type !== 'set_relay') return;

    const pump =
      actuator.target === 'master' ? dosingByRelay.get(actuator.relayIndex) ?? null : null;
    if (pump) {
      const ml = step.dosageMl && step.dosageMl > 0 ? step.dosageMl : 20;
      const raw = calculateDoseDurationSeconds(ml, pump.flowRate);
      onChange({
        ...step,
        actuator,
        state: 'on',
        dosageMl: ml,
        durationSeconds: raw != null ? doseDurationSecondsForRelay(raw) : 1,
      });
      return;
    }
    onChange({
      ...step,
      actuator,
      dosageMl: undefined,
      durationSeconds: step.durationSeconds ?? 0,
    });
  };

  const applyDosageMl = (ml: number) => {
    if (step.type !== 'set_relay' || !dosingPumpForStep) return;
    const raw = ml > 0 ? calculateDoseDurationSeconds(ml, dosingPumpForStep.flowRate) : null;
    onChange({
      ...step,
      state: 'on',
      dosageMl: ml > 0 ? ml : undefined,
      durationSeconds: raw != null ? doseDurationSecondsForRelay(raw) : 0,
    });
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

  const actuatorPicker =
    !useHydraulicRoles && (step.type === 'sensor_valve' || step.type === 'set_relay') ? (
      <ActuatorRelaySelect
        options={actuatorOptions}
        actuator={step.actuator}
        onChangeActuator={setActuator}
      />
    ) : null;

  return (
    <article className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-wide text-dark-textSecondary shrink-0">
          {p.step.replace('{n}', String(index + 1))}
        </p>
        <HwBadge accent="brand">{stepTypeLabel}</HwBadge>
        {headerActions ? (
          <div className="ml-auto flex items-center gap-1 shrink-0">{headerActions}</div>
        ) : null}
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
          {actuatorPicker}
          <p className="text-[11px] text-dark-textSecondary leading-snug">
            {p.sensorValveActuationHint}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs min-w-0">
              <span className="text-dark-textSecondary">{p.valveDuring}</span>
              <select
                value={step.valveStart}
                onChange={(e) =>
                  update({ valveStart: e.target.value as 'open' | 'closed' })
                }
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
              >
                <option value="open">{p.valveOpen}</option>
                <option value="closed">{p.valveClosed}</option>
              </select>
            </label>
            <label className="block text-xs min-w-0">
              <span className="text-dark-textSecondary">{p.valveOnReach}</span>
              <select
                value={step.valveFinish}
                onChange={(e) =>
                  update({ valveFinish: e.target.value as 'open' | 'closed' })
                }
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
              >
                <option value="closed">{p.valveClosed}</option>
                <option value="open">{p.valveOpen}</option>
              </select>
            </label>
          </div>
          <ConditionFields
            label={p.waterCondition}
            condition={{
              sensor: step.sensor.sensor,
              operator: step.sensor.operator === '!=' ? '!=' : '==',
              value: step.sensor.value,
            }}
            onChange={(condition) =>
              update({
                conditionSemantics: 'while',
                sensor: {
                  sensor: condition.sensor,
                  operator: condition.operator === '!=' ? '!=' : '==',
                  value: condition.value,
                },
              })
            }
            sensors={getConditionSensors(t.automacao.instr).filter((s) => s.value === 'water_level')}
            allowedOperators={['==', '!=']}
            operatorLabels={{
              '==': p.waterOpWhileIs,
              '!=': p.waterOpWhileNot,
            }}
          />
          <p className="text-[11px] text-dark-textSecondary -mt-1">{p.waterConditionHint}</p>
          <label className="block text-xs">
            <span className="text-dark-textSecondary">{p.timeoutMin}</span>
            <input
              type="number"
              min={1}
              value={Math.max(
                1,
                Math.round((step.maxDurationMs > 0 ? step.maxDurationMs : 30 * 60 * 1000) / 60000)
              )}
              onChange={(e) =>
                update({
                  maxDurationMs: Math.max(1, Number(e.target.value) || 1) * 60000,
                })
              }
              className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
            />
            <span className="mt-1 block text-[11px] text-dark-textSecondary">{p.timeoutHint}</span>
          </label>
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
          {useHydraulicRoles ? (
            <>
              <label className="block text-xs">
                <span className="text-dark-textSecondary">{p.state}</span>
                <select
                  value={step.state}
                  onChange={(e) => update({ state: e.target.value as 'on' | 'off' })}
                  className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
                >
                  <option value="on">ON</option>
                  <option value="off">OFF</option>
                </select>
              </label>
              {actuatorPicker}
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <label className="block text-xs min-w-0">
                  <span className="text-dark-textSecondary">{p.state}</span>
                  <select
                    value={step.state}
                    onChange={(e) => update({ state: e.target.value as 'on' | 'off' })}
                    className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-aqua-500"
                  >
                    <option value="on">ON</option>
                    <option value="off">OFF</option>
                  </select>
                </label>
                <ActuatorRelaySelect
                  className="min-w-0"
                  options={actuatorOptions}
                  actuator={step.actuator}
                  onChangeActuator={setActuator}
                />
              </div>
              {dosingPumpForStep ? (
                <div className="space-y-1">
                  <label className="block text-xs min-w-0 max-w-xs">
                    <span className="text-dark-textSecondary">{instrT.doseMlLabel}</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={step.dosageMl ?? ''}
                      onChange={(e) => applyDosageMl(Number(e.target.value) || 0)}
                      className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                    />
                  </label>
                  {step.dosageMl != null &&
                    step.dosageMl > 0 &&
                    (() => {
                      const raw = calculateDoseDurationSeconds(
                        step.dosageMl,
                        dosingPumpForStep.flowRate
                      );
                      if (raw == null) return null;
                      const cmd = doseDurationSecondsForRelay(raw);
                      return (
                        <p className="text-[11px] text-dark-textSecondary">
                          {instrT.doseMlPreview
                            .replace('{sec}', formatDoseDurationSeconds(raw))
                            .replace('{cmd}', String(cmd))}
                        </p>
                      );
                    })()}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-xs text-dark-text cursor-pointer select-none">
                    <input
                      type="checkbox"
                      role="switch"
                      className="rounded border-dark-border bg-dark-surface text-aqua-500 focus:ring-aqua-500"
                      checked={(step.durationSeconds ?? 0) > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          update({
                            durationSeconds:
                              (step.durationSeconds ?? 0) > 0 ? step.durationSeconds : 5,
                            dosageMl: undefined,
                          });
                        } else {
                          update({ durationSeconds: 0, dosageMl: undefined });
                        }
                      }}
                    />
                    <span>{p.useDurationToggle}</span>
                  </label>
                  <p className="text-[11px] text-dark-textSecondary">{p.useDurationHint}</p>
                  {(step.durationSeconds ?? 0) > 0 && (
                    <label className="block text-xs min-w-0 max-w-xs">
                      <span className="text-dark-textSecondary">{p.durationSec}</span>
                      <input
                        type="number"
                        min={1}
                        value={step.durationSeconds ?? 5}
                        onChange={(e) =>
                          update({
                            durationSeconds: Math.max(1, Number(e.target.value) || 1),
                            dosageMl: undefined,
                          })
                        }
                        className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                      />
                    </label>
                  )}
                  {step.actuator.target === 'master' && (
                    <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      {p.uncalibratedPumpHint}
                    </p>
                  )}
                </div>
              )}
            </div>
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
