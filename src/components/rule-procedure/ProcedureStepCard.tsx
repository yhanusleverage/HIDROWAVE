'use client';

import type { ProcedureStep } from '@/lib/rule-procedure/types';
import { STEP_TYPE_LABELS } from '@/lib/rule-procedure/types';
import { HwBadge } from '@/components/ui/HwBadge';
import { HW_ACCENT_LEFT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';
import { formatConditionPhrase } from '@/lib/instruction-labels';

const STEP_ACCENT: Record<ProcedureStep['type'], HwAccent> = {
  sensor_valve: 'brand',
  set_relay: 'wait',
  wait: 'neutral',
  hold_chemical: 'ec',
  invoke_rule: 'ph',
};

function formatActuator(step: ProcedureStep): string | null {
  if (step.type === 'sensor_valve' || step.type === 'set_relay') {
    const a = step.actuator;
    const who = a.target === 'master' ? 'Master' : `Slave ${a.slaveMac ?? ''}`;
    return `${who} R${a.relayIndex}${a.label ? ` (${a.label})` : ''}`;
  }
  return null;
}

interface ProcedureStepCardProps {
  step: ProcedureStep;
  index: number;
}

export function ProcedureStepCard({ step, index }: ProcedureStepCardProps) {
  const accent = STEP_ACCENT[step.type];
  const title = 'label' in step && step.label ? step.label : STEP_TYPE_LABELS[step.type];

  return (
    <article
      className={`bg-dark-card border border-dark-border rounded-xl p-4 border-l-4 ${HW_ACCENT_LEFT[accent]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-dark-textSecondary">
            Passo {index + 1}
          </p>
          <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        </div>
        <HwBadge accent={accent}>{STEP_TYPE_LABELS[step.type]}</HwBadge>
      </div>

      <dl className="space-y-1.5 text-xs text-dark-textSecondary">
        {formatActuator(step) && (
          <div className="flex gap-2">
            <dt className={HW_TEXT[accent]}>Atuador</dt>
            <dd className="text-dark-text">{formatActuator(step)}</dd>
          </div>
        )}
        {step.type === 'sensor_valve' && (
          <>
            <div className="flex gap-2">
              <dt>Nível</dt>
              <dd className="text-dark-text">
                {formatConditionPhrase(step.sensor)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Valvula</dt>
              <dd className="text-dark-text">
                {step.valveStart} → {step.valveFinish} · max {Math.round(step.maxDurationMs / 60000)} min
              </dd>
            </div>
          </>
        )}
        {step.type === 'set_relay' && (
          <div className="flex gap-2">
            <dt>Estado</dt>
            <dd className="text-dark-text uppercase">{step.state}</dd>
          </div>
        )}
        {step.type === 'wait' && (
          <div className="flex gap-2">
            <dt>Duracao</dt>
            <dd className="text-dark-text">{Math.round(step.durationMs / 1000)} s</dd>
          </div>
        )}
        {step.type === 'hold_chemical' && (
          <div className="flex gap-2">
            <dt>Hold EC/pH</dt>
            <dd className="text-dark-text">{step.enabled ? 'Ativo' : 'Inativo'}</dd>
          </div>
        )}
        {step.type === 'invoke_rule' && (
          <div className="flex gap-2">
            <dt>Regra</dt>
            <dd className="text-dark-text font-mono">{step.targetRuleId}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
