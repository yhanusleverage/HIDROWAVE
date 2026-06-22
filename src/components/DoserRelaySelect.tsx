'use client';

import {
  type RelayAllocationRegistry,
  type RelaySelectContext,
  getSelectableRelays,
  formatRelayConflictMessage,
} from '@/lib/relay-allocation';

export interface DoserRelaySelectProps {
  registry: RelayAllocationRegistry;
  context: RelaySelectContext;
  value: number;
  onChange: (relayNumber: number) => void;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  showConflictHint?: boolean;
}

export function DoserRelaySelect({
  registry,
  context,
  value,
  onChange,
  disabled = false,
  className = 'w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text disabled:opacity-50',
  emptyMessage = 'Nenhum relé livre (0–7). Libere um relé em Auto EC ou pH.',
  showConflictHint = true,
}: DoserRelaySelectProps) {
  const options = getSelectableRelays(registry, { ...context, currentValue: value });
  const conflictMessage = showConflictHint
    ? formatRelayConflictMessage(registry, value, { ...context, currentValue: value })
    : null;

  if (options.length === 0) {
    return (
      <div>
        <p className="text-xs text-amber-400/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={className}
      >
        {options.map((relay) => (
          <option key={relay.number} value={relay.number}>
            {relay.number}: {relay.name}
          </option>
        ))}
      </select>
      {conflictMessage && (
        <p className="mt-1 text-xs text-amber-400/95 leading-relaxed">{conflictMessage}</p>
      )}
    </div>
  );
}
