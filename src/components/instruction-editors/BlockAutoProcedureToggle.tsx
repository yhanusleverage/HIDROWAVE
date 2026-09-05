'use client';

import type { Instruction } from '@/components/SequentialScriptEditor';
import { createNestedInstruction } from '@/lib/instruction-factory';
import { useLanguage } from '@/contexts/LanguageContext';

export function hasBlockAuto(instructions: Instruction[]): boolean {
  return instructions.some((i) => i.type === 'block_auto');
}

export function withBlockAuto(instructions: Instruction[], enabled: boolean): Instruction[] {
  const rest = instructions.filter((i) => i.type !== 'block_auto');
  if (!enabled) return rest;
  return [createNestedInstruction('block_auto'), ...rest];
}

interface BlockAutoProcedureToggleProps {
  instructions: Instruction[];
  onChange: (next: Instruction[]) => void;
  className?: string;
}

/** Toggle de produto: pausar Auto EC/pH durante o procedimento (injeta block_auto no topo). */
export function BlockAutoProcedureToggle({
  instructions,
  onChange,
  className = '',
}: BlockAutoProcedureToggleProps) {
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const enabled = hasBlockAuto(instructions);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
        enabled
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-dark-border bg-dark-surface/60'
      } ${className}`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-medium ${enabled ? 'text-amber-200' : 'text-dark-text'}`}>
          {instrT.toggleBlockAuto}
        </p>
        <p className="text-xs text-dark-textSecondary mt-0.5 leading-snug">
          {instrT.toggleBlockAutoHint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(withBlockAuto(instructions, !enabled))}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
          enabled
            ? 'bg-amber-500/80 border-amber-400/60'
            : 'bg-dark-bg border-dark-border'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-150 mt-0.5 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
