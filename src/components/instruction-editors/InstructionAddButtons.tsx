'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import {
  formatInstructionType,
  INSTRUCTION_TYPE_HINTS,
} from '@/lib/instruction-labels';
import type { Instruction } from '@/components/SequentialScriptEditor';

const ADD_TYPES: Instruction['type'][] = ['while', 'if', 'relay_action', 'switch'];

interface InstructionAddButtonsProps {
  onAdd: (type: Instruction['type']) => void;
  className?: string;
}

export function InstructionAddButtons({ onAdd, className = '' }: InstructionAddButtonsProps) {
  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {ADD_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          title={INSTRUCTION_TYPE_HINTS[type]}
          onClick={() => onAdd(type)}
          className="px-3 py-2 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-lg text-sm text-white transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {formatInstructionType(type)}
        </button>
      ))}
    </div>
  );
}
