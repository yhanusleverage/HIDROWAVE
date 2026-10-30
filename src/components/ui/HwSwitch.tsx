'use client';

import React from 'react';

export type HwSwitchAccent = 'aqua' | 'violet';

interface HwSwitchProps {
  checked: boolean;
  disabled?: boolean;
  title: string;
  hint?: string;
  accent?: HwSwitchAccent;
  onChange: (next: boolean) => void;
}

const ON_TRACK: Record<HwSwitchAccent, string> = {
  aqua: 'bg-aqua-500/80 border-aqua-400/60 focus:ring-aqua-500/50',
  violet: 'bg-violet-500/80 border-violet-400/60 focus:ring-violet-500/50',
};

const ON_CARD: Record<HwSwitchAccent, string> = {
  aqua: 'border-aqua-500/40 bg-aqua-500/10',
  violet: 'border-violet-500/40 bg-violet-500/10',
};

/** Interruptor de dos estados: título y texto a la izquierda, pista a la derecha. */
export function HwSwitch({
  checked,
  disabled = false,
  title,
  hint,
  accent = 'aqua',
  onChange,
}: HwSwitchProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
        checked ? ON_CARD[accent] : 'border-dark-border bg-dark-surface/40'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-dark-text">{title}</p>
        {hint ? (
          <p className="text-xs text-dark-textSecondary mt-0.5 leading-snug">{hint}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
          checked ? ON_TRACK[accent] : 'bg-dark-bg border-dark-border'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-150 mt-0.5 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
