'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import {
  formatInstructionType,
  getInstructionTypeHints,
} from '@/lib/instruction-labels';
import type { Instruction } from '@/components/SequentialScriptEditor';
import { useLanguage } from '@/contexts/LanguageContext';

const ADD_TYPES: Instruction['type'][] = [
  'while',
  'if',
  'relay_action',
  'switch',
];

interface InstructionAddButtonsProps {
  onAdd: (type: Instruction['type']) => void;
  className?: string;
}

export function InstructionAddButtons({ onAdd, className = '' }: InstructionAddButtonsProps) {
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const hints = getInstructionTypeHints(instrT);

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {ADD_TYPES.map((type) => (
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
