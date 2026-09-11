'use client';

import { useMemo } from 'react';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { ProcedureStepEditor } from '@/components/rule-procedure/ProcedureStepEditor';
import type { ProcedureStep } from '@/lib/rule-procedure/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { createProcedureStep } from '@/lib/rule-procedure/create-step';
import type { ActuatorRelayOption } from '@/lib/actuator-relay-options';
import type { DosingPumpOption } from '@/lib/dosing-pump-options';

interface RuleModalProcedureBuilderProps {
  steps: ProcedureStep[];
  onChange: (steps: ProcedureStep[]) => void;
  /** Mesma lista Core+Atlas das ações simples */
  actuatorOptions?: ActuatorRelayOption[];
  dosingPumps?: DosingPumpOption[];
}

export function RuleModalProcedureBuilder({
  steps,
  onChange,
  actuatorOptions = [],
  dosingPumps = [],
}: RuleModalProcedureBuilderProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const ac = t.automacao.common;

  const defaultActuator = useMemo(() => {
    const first = actuatorOptions[0];
    if (!first) {
      return { target: 'slave' as const, relayIndex: 0, slaveMac: '' };
    }
    return {
      target: first.kind,
      relayIndex: first.relayId,
      slaveMac: first.slaveMac,
      label: first.label,
    };
  }, [actuatorOptions]);

  const updateStep = (index: number, step: ProcedureStep) => {
    onChange(steps.map((s, i) => (i === index ? step : s)));
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: 'up' | 'down') => {
    const next = [...steps];
    const j = dir === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const add = (type: ProcedureStep['type']) => {
    const step = createProcedureStep(type);
    if (step.type === 'sensor_valve' || step.type === 'set_relay') {
      step.actuator = { ...defaultActuator };
    }
    onChange([...steps, step]);
  };

  const addButtons: Array<{ type: ProcedureStep['type']; label: string }> = [
    { type: 'sensor_valve', label: p.stepSensorValve },
    { type: 'set_relay', label: p.stepSetRelay },
    { type: 'wait', label: p.stepWait },
    { type: 'hold_chemical', label: p.stepHoldChemical },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {addButtons.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              add(type);
            }}
            className="px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 bg-dark-surface hover:bg-dark-border border-dark-border text-white"
          >
            <PlusIcon className="w-4 h-4 pointer-events-none" />
            {label}
          </button>
        ))}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-dark-textSecondary/80 italic py-2">{p.emptyStepsModal}</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <ProcedureStepEditor
              key={step.id}
              step={step}
              index={index}
              useHydraulicRoles={false}
              actuatorOptions={actuatorOptions}
              dosingPumps={dosingPumps}
              onChange={(s) => updateStep(index, s)}
              headerActions={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      moveStep(index, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-dark-surface rounded disabled:opacity-40"
                    title={ac.moveUp}
                  >
                    <ArrowUpIcon className="w-4 h-4 text-dark-textSecondary" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      moveStep(index, 'down');
                    }}
                    disabled={index === steps.length - 1}
                    className="p-1.5 hover:bg-dark-surface rounded disabled:opacity-40"
                    title={ac.moveDown}
                  >
                    <ArrowDownIcon className="w-4 h-4 text-dark-textSecondary" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeStep(index);
                    }}
                    className="p-1.5 hover:bg-dark-surface rounded"
                    title={ac.remove}
                  >
                    <TrashIcon className="w-4 h-4 text-red-400" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
