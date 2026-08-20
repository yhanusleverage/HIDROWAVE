'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CloudArrowUpIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HW_BANNER } from '@/lib/design-tokens';
import { SlaveRelaySelect } from '@/components/SlaveRelaySelect';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  HYDRAULIC_ROLE_DEFINITIONS,
  normalizeHydraulicRolesJson,
  validateHydraulicRolesMap,
  type HydraulicRoleBinding,
  type HydraulicRoleId,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import type { SlaveRelayRef } from '@/lib/slave-relay-allocation';

interface HydraulicRelaySetupPanelProps {
  deviceId: string;
  espnowSlaves: ESPNowSlave[];
  onRolesChange?: (roles: HydraulicRolesMap) => void;
}

function bindingToRef(binding?: HydraulicRoleBinding): SlaveRelayRef | null {
  if (!binding?.slaveMac) return null;
  return { slaveMac: binding.slaveMac, relayId: binding.relayIndex };
}

function refToBinding(ref: SlaveRelayRef | null): HydraulicRoleBinding | undefined {
  if (!ref?.slaveMac) return undefined;
  return { target: 'slave', slaveMac: ref.slaveMac, relayIndex: ref.relayId };
}

export function HydraulicRelaySetupPanel({
  deviceId,
  espnowSlaves,
  onRolesChange,
}: HydraulicRelaySetupPanelProps) {
  const [roles, setRoles] = useState<HydraulicRolesMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') {
      setRoles({});
      onRolesChange?.({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/automation/hydraulic-roles?device_id=${encodeURIComponent(deviceId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao carregar tipagem');
        return;
      }
      const next = normalizeHydraulicRolesJson(data.roles);
      setRoles(next);
      onRolesChange?.(next);
    } catch {
      toast.error('Erro de rede ao carregar tipagem');
    } finally {
      setLoading(false);
    }
  }, [deviceId, onRolesChange]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const reservedForRole = useCallback(
    (roleId: HydraulicRoleId): SlaveRelayRef[] => {
      const refs: SlaveRelayRef[] = [];
      for (const [id, binding] of Object.entries(roles) as [
        HydraulicRoleId,
        HydraulicRoleBinding | undefined,
      ][]) {
        if (id === roleId || !binding?.slaveMac) continue;
        refs.push({ slaveMac: binding.slaveMac, relayId: binding.relayIndex });
      }
      return refs;
    },
    [roles]
  );

  const validationErrors = useMemo(() => validateHydraulicRolesMap(roles), [roles]);

  const updateRole = (roleId: HydraulicRoleId, ref: SlaveRelayRef | null) => {
    setRoles((prev) => {
      const next = { ...prev };
      const binding = refToBinding(ref);
      if (binding) next[roleId] = binding;
      else delete next[roleId];
      onRolesChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!deviceId || deviceId === 'default_device') {
      toast.error('Selecione um HydroWave Core');
      return;
    }
    const errors = validateHydraulicRolesMap(roles);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/automation/hydraulic-roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, roles }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao guardar tipagem');
        return;
      }
      const next = normalizeHydraulicRolesJson(data.roles);
      setRoles(next);
      onRolesChange?.(next);
      toast.success('Tipagem hidráulica guardada');
    } catch {
      toast.error('Erro de rede ao guardar tipagem');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !deviceId || deviceId === 'default_device' || loading;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 sm:p-6 space-y-4">
      <SectionHeader
        title="Tipagem de relés hidráulicos"
        subtitle="Funções fixas P1 — configure uma vez por Core"
        accent="brand"
      />

      <div className={`rounded-lg border px-3 py-2 text-xs ${HW_BANNER.wait}`}>
        <p className="flex items-center gap-1.5 font-medium">
          <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
          Relés do Core 0–7 são dosadores Auto EC/pH — não use aqui
        </p>
      </div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${HW_BANNER.warn}`}>
        <p className="flex items-center gap-1.5 font-medium">
          <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
          <code className="font-mono">tempo_recirculacao</code> (Auto EC/pH) não controla a bomba de
          circulação — configure a bomba abaixo
        </p>
      </div>

      {disabled && (
        <p className="text-sm text-dark-textSecondary">
          Selecione um Core na barra superior para configurar a tipagem.
        </p>
      )}

      <div className="space-y-4">
        {HYDRAULIC_ROLE_DEFINITIONS.map((def) => (
          <div
            key={def.id}
            className="rounded-lg border border-dark-border bg-dark-surface/40 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-dark-text">{def.label}</p>
                <p className="text-xs text-dark-textSecondary mt-0.5">{def.description}</p>
              </div>
              <HwBadge accent="wait">Função fixa</HwBadge>
            </div>
            <p className="text-[11px] text-dark-textSecondary/90">{def.fixedBehavior}</p>
            <SlaveRelaySelect
              slaves={espnowSlaves}
              label={def.required ? `${def.label} *` : def.label}
              value={bindingToRef(roles[def.id])}
              reserved={reservedForRole(def.id)}
              onChange={(ref) => updateRole(def.id, ref)}
              disabled={disabled}
              emptyMessage="Nenhum relé Atlas disponível. Verifique HydroWave Atlas na aba Regras."
            />
          </div>
        ))}
      </div>

      {validationErrors.length > 0 && (
        <ul className="text-xs text-amber-300/90 list-disc list-inside space-y-0.5">
          {validationErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={disabled || saving || validationErrors.length > 0}
        onClick={() => void handleSave()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-sm font-medium"
      >
        <CloudArrowUpIcon className="w-4 h-4" />
        {saving ? 'Guardando…' : 'Salvar tipagem'}
      </button>
    </div>
  );
}
