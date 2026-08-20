'use client';

import type { HydraulicRoleId, ProcedureStep } from '@/lib/rule-procedure/types';
import { STEP_TYPE_LABELS } from '@/lib/rule-procedure/types';
import { HwBadge } from '@/components/ui/HwBadge';
import ConditionFields from '@/components/instruction-editors/ConditionFields';
import { CONDITION_SENSORS } from '@/lib/instruction-labels';
import { getHydraulicRoleDefinition } from '@/lib/hydraulic-relay-roles';

const VALVE_ROLE_OPTIONS: { id: HydraulicRoleId; label: string }[] = [
  { id: 'fill_valve', label: 'Válvula de enchimento' },
  { id: 'drain_valve', label: 'Válvula de dreno' },
  { id: 'recharge_pump', label: 'Bomba de recarga' },
];

const RELAY_ROLE_OPTIONS: { id: HydraulicRoleId; label: string }[] = [
  { id: 'circulation_pump', label: 'Bomba de circulação' },
  { id: 'recharge_pump', label: 'Bomba de recarga' },
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
          Passo {index + 1}
        </p>
        <HwBadge accent="brand">{STEP_TYPE_LABELS[step.type]}</HwBadge>
      </div>

      {'label' in step && (
        <label className="block text-xs">
          <span className="text-dark-textSecondary">Label</span>
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
              <span className="text-dark-textSecondary">Função hidráulica</span>
              <select
                value={step.roleId ?? 'fill_valve'}
                onChange={(e) => setRoleId(e.target.value as HydraulicRoleId)}
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
              >
                {VALVE_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ConditionFields
            label="Condição (nível de água)"
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
            sensors={CONDITION_SENSORS.filter((s) => s.value === 'water_level')}
          />
          <label className="block text-xs">
            <span className="text-dark-textSecondary">Timeout (min)</span>
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
                  <span className="text-dark-textSecondary">Target</span>
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
                  <span className="text-dark-textSecondary">Relé</span>
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
                  <span className="text-dark-textSecondary">MAC Atlas</span>
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
              <span className="text-dark-textSecondary">Função hidráulica</span>
              <select
                value={step.roleId ?? 'circulation_pump'}
                onChange={(e) => setRoleId(e.target.value as HydraulicRoleId)}
                className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
              >
                {RELAY_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={`grid gap-2 text-xs ${useHydraulicRoles ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <label className="block">
              <span className="text-dark-textSecondary">Estado</span>
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
                  <span className="text-dark-textSecondary">Target</span>
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
                  <span className="text-dark-textSecondary">Relé</span>
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
              <span className="text-dark-textSecondary">MAC Atlas</span>
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
          <span className="text-dark-textSecondary">Duração (segundos)</span>
          <input
            type="number"
            min={1}
            value={Math.round(step.durationMs / 1000)}
            onChange={(e) => update({ durationMs: Number(e.target.value) * 1000 })}
            className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded"
          />
        </label>
      )}
    </article>
  );
}
