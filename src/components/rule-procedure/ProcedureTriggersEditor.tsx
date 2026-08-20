'use client';

import type { RuleProcedure } from '@/lib/rule-procedure/types';

interface ProcedureTriggersEditorProps {
  triggers: RuleProcedure['triggers'];
  onChange: (triggers: RuleProcedure['triggers']) => void;
}

export function ProcedureTriggersEditor({ triggers, onChange }: ProcedureTriggersEditorProps) {
  const tw = triggers.find((t) => t.type === 'time_window');

  if (!tw || tw.type !== 'time_window') {
    return (
      <p className="text-xs text-dark-textSecondary">Nenhum trigger time_window configurado.</p>
    );
  }

  const updateWindow = (patch: Partial<typeof tw>) => {
    onChange(
      triggers.map((t) => (t.type === 'time_window' ? { ...t, ...patch } : t))
    );
  };

  return (
    <div className="grid sm:grid-cols-3 gap-3 text-xs">
      <label className="block">
        <span className="text-dark-textSecondary">Início</span>
        <input
          type="time"
          value={tw.start}
          onChange={(e) => updateWindow({ start: e.target.value })}
          className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
        />
      </label>
      <label className="block">
        <span className="text-dark-textSecondary">Fim</span>
        <input
          type="time"
          value={tw.end}
          onChange={(e) => updateWindow({ end: e.target.value })}
          className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
        />
      </label>
      <label className="block">
        <span className="text-dark-textSecondary">Timezone</span>
        <input
          type="text"
          value={tw.timezone ?? ''}
          onChange={(e) => updateWindow({ timezone: e.target.value })}
          className="mt-1 w-full p-2 bg-dark-surface border border-dark-border rounded-lg"
        />
      </label>
    </div>
  );
}
