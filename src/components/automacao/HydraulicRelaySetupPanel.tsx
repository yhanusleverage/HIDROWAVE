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
import { useLanguage } from '@/contexts/LanguageContext';
import { hydraulicRoleCopy } from '@/lib/translations/app/procedure-roles';

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
  const { t } = useLanguage();
  const p = t.automacao.procedures;
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
        toast.error(data.error ?? p.loadTypeError);
        return;
      }
      const next = normalizeHydraulicRolesJson(data.roles);
      setRoles(next);
      onRolesChange?.(next);
    } catch {
      toast.error(p.typeNetworkError);
    } finally {
      setLoading(false);
    }
  }, [deviceId, onRolesChange, p.loadTypeError, p.typeNetworkError]);

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
      toast.error(p.selectCoreSave);
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
        toast.error(data.error ?? p.typeSaveError);
        return;
      }
      const next = normalizeHydraulicRolesJson(data.roles);
      setRoles(next);
      onRolesChange?.(next);
      toast.success(p.typeSaved);
    } catch {
      toast.error(p.typeNetworkError);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !deviceId || deviceId === 'default_device' || loading;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 sm:p-6 space-y-4">
      <SectionHeader
        title={p.typeTitle}
        subtitle={p.typeSubtitle}
        accent="brand"
      />

      <div className={`rounded-lg border px-3 py-2 text-xs ${HW_BANNER.wait}`}>
        <p className="flex items-center gap-1.5 font-medium">
          <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
          {p.coreRelaysHint}
        </p>
      </div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${HW_BANNER.warn}`}>
        <p className="flex items-center gap-1.5 font-medium">
          <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
          {p.recircHint}
        </p>
      </div>

      {disabled && (
        <p className="text-sm text-dark-textSecondary">
          {p.selectCoreType}
        </p>
      )}

      <div className="space-y-4">
        {HYDRAULIC_ROLE_DEFINITIONS.map((def) => {
          const copy = hydraulicRoleCopy(p, def.id);
          return (
          <div
            key={def.id}
            className="rounded-lg border border-dark-border bg-dark-surface/40 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-dark-text">{copy.label}</p>
                <p className="text-xs text-dark-textSecondary mt-0.5">{copy.description}</p>
              </div>
              <HwBadge accent="wait">{p.fixedRole}</HwBadge>
            </div>
            <p className="text-[11px] text-dark-textSecondary/90">{copy.hint}</p>
            <SlaveRelaySelect
              slaves={espnowSlaves}
              label={def.required ? `${copy.label} *` : copy.label}
              value={bindingToRef(roles[def.id])}
              reserved={reservedForRole(def.id)}
              onChange={(ref) => updateRole(def.id, ref)}
              disabled={disabled}
              emptyMessage={p.emptyAtlasRelays}
            />
          </div>
          );
        })}
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
        {saving ? p.saving : p.saveType}
      </button>
    </div>
  );
}
