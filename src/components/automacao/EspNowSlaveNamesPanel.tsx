'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckIcon } from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';

interface EspNowSlaveNamesPanelProps {
  deviceId: string;
  slaves: ESPNowSlave[];
  onSlavesRefresh?: () => void | Promise<void>;
}

export function EspNowSlaveNamesPanel({
  deviceId,
  slaves,
  onSlavesRefresh,
}: EspNowSlaveNamesPanelProps) {
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const slave of slaves) {
      const key = slave.device_id ?? slave.macAddress;
      next[key] = slave.name;
    }
    setDraftNames(next);
  }, [slaves]);

  const disabled = !deviceId || deviceId === 'default_device';

  const handleSave = async (slave: ESPNowSlave) => {
    const key = slave.device_id ?? slave.macAddress;
    const name = (draftNames[key] ?? '').trim();
    if (!slave.device_id) {
      toast.error('Atlas ainda sem registo completo — aguarde sync do firmware');
      return;
    }
    if (!name) {
      toast.error('Digite um nome para o Atlas');
      return;
    }
    if (name === slave.name) return;

    setSavingId(key);
    try {
      const res = await fetch('/api/esp-now/slave-device-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: slave.device_id,
          device_name: name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao guardar nome');
        return;
      }
      toast.success(`Atlas renomeado: ${name}`);
      await onSlavesRefresh?.();
    } catch {
      toast.error('Erro de rede ao guardar nome');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 sm:p-6 space-y-4">
      <SectionHeader
        title="Identificar HydroWave Atlas"
        subtitle="Um Core pode ter vários Atlas — dê nomes amigáveis antes da tipagem"
        accent="wait"
      />

      {disabled && (
        <p className="text-sm text-dark-textSecondary">
          Selecione um Core na barra superior para identificar os Atlas.
        </p>
      )}

      {!disabled && slaves.length === 0 && (
        <p className="text-sm text-dark-textSecondary">
          Nenhum Atlas registado. Os Atlas aparecem aqui quando o Core os descobre via
          ESP-NOW.
        </p>
      )}

      {!disabled && slaves.length > 0 && (
        <div className="space-y-3">
          {slaves.map((slave) => {
            const key = slave.device_id ?? slave.macAddress;
            const draft = draftNames[key] ?? slave.name;
            const dirty = draft.trim() !== slave.name;
            const isSaving = savingId === key;

            return (
              <div
                key={slave.macAddress}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-dark-border bg-dark-surface/40 p-3"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <label className="block text-xs text-dark-textSecondary">
                    Nome do Atlas
                    <span
                      className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        slave.status === 'online'
                          ? 'bg-aqua-500/15 text-aqua-400 border border-aqua-500/30'
                          : 'bg-dark-border/50 text-dark-textSecondary'
                      }`}
                    >
                      {slave.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={draft}
                    disabled={isSaving}
                    onChange={(e) =>
                      setDraftNames((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="Ex.: Caixa hidráulica A, RelayBox sala 2…"
                    className="w-full p-2.5 bg-dark-surface border border-violet-500/25 rounded-lg text-sm text-dark-text focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-dark-textSecondary">
                    {slave.relays.length} relé{slave.relays.length === 1 ? '' : 's'} disponíve
                    {slave.relays.length === 1 ? 'l' : 'is'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!dirty || isSaving || !slave.device_id}
                  onClick={() => void handleSave(slave)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-medium shrink-0"
                >
                  <CheckIcon className="w-4 h-4" />
                  {isSaving ? 'Guardando…' : 'Guardar nome'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
