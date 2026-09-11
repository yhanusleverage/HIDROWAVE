'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import {
  formatInstructionType,
  getInstructionTypeHints,
} from '@/lib/instruction-labels';
import type { Instruction } from '@/components/SequentialScriptEditor';
import { useLanguage } from '@/contexts/LanguageContext';

/** UI padrão: sem puzzle Se/LOOP aninhados — só ações planas. */
const DEFAULT_ADD_TYPES: Instruction['type'][] = ['relay_action', 'switch'];

interface InstructionAddButtonsProps {
  onAdd: (type: Instruction['type']) => void;
  className?: string;
  /** Override (ex.: modo avançado). Default = só Relé + Switch. */
  allowedTypes?: Instruction['type'][];
}

export function InstructionAddButtons({
  onAdd,
  className = '',
  allowedTypes = DEFAULT_ADD_TYPES,
}: InstructionAddButtonsProps) {
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const hints = getInstructionTypeHints(instrT);

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {allowedTypes.map((type) => (
        <button
          key={type}
          type="button"
          title={hints[type]}
          onClick={() => onAdd(type)}
          className="px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 bg-dark-surface hover:bg-dark-border border-dark-border text-white"
        >
          <PlusIcon className="w-4 h-4" />
          {formatInstructionType(type, instrT)}
        </button>
      ))}
    </div>
  );
}
