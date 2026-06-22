'use client';

import React from 'react';
import { Instruction } from '../SequentialScriptEditor';

interface DelayEditorProps {
  instruction: Instruction;
  onChange: (updated: Instruction) => void;
}

export default function DelayEditor({ instruction, onChange }: DelayEditorProps) {
  return (
    <div>
      <label className="block text-xs text-dark-textSecondary mb-1">Duração (ms)</label>
      <input
        type="number"
        min="0"
        value={instruction.duration_ms || 1000}
        onChange={(e) =>
          onChange({
            ...instruction,
            duration_ms: parseInt(e.target.value) || 1000,
          })
        }
        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-aqua-500"
      />
    </div>
  );
}
