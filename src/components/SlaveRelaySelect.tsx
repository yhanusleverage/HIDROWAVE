'use client';

import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  buildSlaveRelayOptions,
  formatSlaveRelayLabel,
  parseSlaveRelayKey,
  slaveRelayKey,
  type SlaveRelayRef,
} from '@/lib/slave-relay-allocation';

export interface SlaveRelaySelectProps {
  slaves: ESPNowSlave[];
  label: string;
  value: SlaveRelayRef | null;
  reserved: SlaveRelayRef[];
  onChange: (ref: SlaveRelayRef | null) => void;
  disabled?: boolean;
  emptyMessage?: string;
  /** Exibe MAC abaixo do select (suporte técnico). Padrão: oculto. */
  showMac?: boolean;
}

export function SlaveRelaySelect({
  slaves,
  label,
  value,
  reserved,
  onChange,
  disabled = false,
  emptyMessage = 'Nenhum relé Atlas disponível. Verifique Atlas online na bancada.',
  showMac = false,
}: SlaveRelaySelectProps) {
  const options = buildSlaveRelayOptions(slaves, reserved, value);
  const selectedKey = value?.slaveMac ? slaveRelayKey(value) : '';
  const selectedLabel = value
    ? options.find((o) => o.valueKey === selectedKey)
    : undefined;

  if (slaves.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <p className="text-xs font-medium text-amber-300/95 mb-1">{label}</p>
        <p className="text-xs text-amber-400/90">Nenhum HydroWave Atlas registado para este Core.</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <p className="text-xs font-medium text-amber-300/95 mb-1">{label}</p>
        <p className="text-xs text-amber-400/90">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-dark-textSecondary">{label}</span>
        <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border border-violet-500/40 bg-violet-500/15 text-violet-300">
          HydroWave Atlas
        </span>
      </div>
      <select
        value={selectedKey}
        disabled={disabled}
        onChange={(e) => {
          const key = e.target.value;
          if (!key) {
            onChange(null);
            return;
          }
          onChange(parseSlaveRelayKey(key));
        }}
        className="w-full p-2.5 bg-dark-surface border border-violet-500/25 rounded-lg text-dark-text text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 disabled:opacity-50"
      >
        <option value="">— Selecionar relé Atlas —</option>
        {options.map((opt) => (
          <option key={opt.valueKey} value={opt.valueKey}>
            {formatSlaveRelayLabel(opt)}
            {!opt.slaveOnline ? ' (offline)' : ''}
          </option>
        ))}
      </select>
      {value && selectedLabel && (
        <p className="text-[11px] text-dark-textSecondary truncate">
          {formatSlaveRelayLabel(selectedLabel)}
        </p>
      )}
      {value && showMac && (
        <p className="text-[11px] text-dark-textSecondary/60 font-mono truncate">
          {value.slaveMac} · relé {value.relayId}
        </p>
      )}
    </div>
  );
}
