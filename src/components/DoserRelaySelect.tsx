'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { isPeristalticDosingRelay } from '@/lib/dosing-pump-registry';
import { isSolutionName } from '@/lib/pump-display';
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
  /** Muestra «--» y avisa con -1. El relé 0 sigue siendo una bomba. */
  allowEmpty?: boolean;
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
  emptyMessage = 'Nenhuma bomba livre. Libere uma em Auto EC ou pH.',
  showConflictHint = true,
  allowEmpty = false,
}: DoserRelaySelectProps) {
  const { t } = useLanguage();
  const options = getSelectableRelays(registry, { ...context, currentValue: value }).filter(
    (relay) => isPeristalticDosingRelay(relay.number)
  );
  const conflictMessage = showConflictHint
    ? formatRelayConflictMessage(registry, value, { ...context, currentValue: value })
    : null;

  if (options.length === 0 && !allowEmpty) {
    return (
      <div>
        <p className="text-xs text-amber-400/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const optionLabel = (relayNumber: number, name: string) => {
    const pump = t.calibragem.flow.pumpN.replace('{n}', String(relayNumber + 1));
    if (!isSolutionName(name, relayNumber)) return pump;
    return `${pump} · ${name.trim()}`;
  };

  return (
    <div>
      <select
        value={allowEmpty && value < 0 ? -1 : value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={className}
      >
        {allowEmpty && <option value={-1}>--</option>}
        {options.map((relay) => (
          <option key={relay.number} value={relay.number}>
            {optionLabel(relay.number, relay.name)}
          </option>
        ))}
      </select>
      {conflictMessage && (
        <p className="mt-1 text-xs text-amber-400/95 leading-relaxed">{conflictMessage}</p>
      )}
    </div>
  );
}
