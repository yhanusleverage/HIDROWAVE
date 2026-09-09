'use client';

import type { GrowPhase } from '@/lib/grow-cycle-timeline/types';
import { GROW_PHASES } from '@/lib/grow-cycle-timeline/types';
import type { HwAccent } from '@/lib/design-tokens';

const PHASE_ACCENT: Record<GrowPhase, HwAccent> = {
  establishment: 'ok',
  vegetative: 'ec',
  flip: 'warn',
  flower: 'ph',
  flush: 'wait',
};

const PHASE_BTN: Record<
  GrowPhase,
  { idle: string; active: string }
> = {
  establishment: {
    idle: 'border-emerald-500/25 text-emerald-300/80 hover:bg-emerald-500/10',
    active: 'border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow-sm shadow-emerald-500/20',
  },
  vegetative: {
    idle: 'border-green-500/25 text-green-300/80 hover:bg-green-500/10',
    active: 'border-green-400 bg-green-500/25 text-green-200 shadow-sm shadow-green-500/20',
  },
  flip: {
    idle: 'border-amber-500/25 text-amber-300/80 hover:bg-amber-500/10',
    active: 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-sm shadow-amber-500/20',
  },
  flower: {
    idle: 'border-violet-500/25 text-violet-300/80 hover:bg-violet-500/10',
    active: 'border-violet-400 bg-violet-500/25 text-violet-200 shadow-sm shadow-violet-500/20',
  },
  flush: {
    idle: 'border-cyan-500/25 text-cyan-300/80 hover:bg-cyan-500/10',
    active: 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-sm shadow-cyan-500/20',
  },
};

export interface PhaseFlipButtonsProps {
  value: GrowPhase;
  labels: Record<GrowPhase, string>;
  onChange: (phase: GrowPhase) => void;
  ariaLabel: string;
  /** compact = timeline chrome; default = week detail */
  size?: 'sm' | 'md';
  className?: string;
}

export function PhaseFlipButtons({
  value,
  labels,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: PhaseFlipButtonsProps) {
  const pad = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {GROW_PHASES.map((phase) => {
        const active = value === phase;
        const styles = PHASE_BTN[phase];
        return (
          <button
            key={phase}
            type="button"
            aria-pressed={active}
            data-accent={PHASE_ACCENT[phase]}
            onClick={() => {
              if (!active) onChange(phase);
            }}
            className={`rounded-lg border font-semibold transition-colors ${pad} ${
              active ? styles.active : styles.idle
            }`}
          >
            {labels[phase]}
          </button>
        );
      })}
    </div>
  );
}
