'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  type HydraulicRoleBinding,
  type HydraulicRoleId,
  type HydraulicRolesMap,
} from '@/lib/hydraulic-relay-roles';
import type { SlaveRelayRef } from '@/lib/slave-relay-allocation';
import { useLanguage } from '@/contexts/LanguageContext';
import { hydraulicRoleCopy } from '@/lib/translations/app/procedure-roles';
import { supabase } from '@/lib/supabase';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';

interface HydraulicRelaySetupPanelProps {
  deviceId: string;
  espnowSlaves: ESPNowSlave[];
  onRolesChange?: (roles: HydraulicRolesMap) => void;
  /** essential = só circulação; advanced = fill/drain/recharge; all = tudo */
  mode?: 'essential' | 'advanced' | 'all';
  /** Estado controlado pelo pai (evita dois fetches). */
  roles?: HydraulicRolesMap;
  onRolesStateChange?: (roles: HydraulicRolesMap) => void;
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
  mode = 'all',
  roles: controlledRoles,
  onRolesStateChange,
}: HydraulicRelaySetupPanelProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const [internalRoles, setInternalRoles] = useState<HydraulicRolesMap>({});
  const isControlled = controlledRoles !== undefined;
  const roles = isControlled ? controlledRoles! : internalRoles;
  const [loading, setLoading] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<HydraulicRoleId | null>(null);

  const onRolesChangeRef = useRef(onRolesChange);
  const onRolesStateChangeRef = useRef(onRolesStateChange);
  onRolesChangeRef.current = onRolesChange;
  onRolesStateChangeRef.current = onRolesStateChange;

  const applyRoles = useCallback(
    (next: HydraulicRolesMap) => {
      if (isControlled) {
        onRolesStateChangeRef.current?.(next);
      } else {
        setInternalRoles(next);
      }
      // Evitar double-set se o pai passou o mesmo setter nas duas props
      if (
        onRolesChangeRef.current &&
        onRolesChangeRef.current !== onRolesStateChangeRef.current
      ) {
        onRolesChangeRef.current(next);
      }
    },
    [isControlled]
  );

  const visibleDefs = HYDRAULIC_ROLE_DEFINITIONS.filter((def) => {
    if (mode === 'essential') return def.id === 'circulation_pump';
    if (mode === 'advanced') return def.id !== 'circulation_pump';
    return true;
  });

  const loadErrorRef = useRef(p.loadTypeError);
  const networkErrorRef = useRef(p.typeNetworkError);
  loadErrorRef.current = p.loadTypeError;
  networkErrorRef.current = p.typeNetworkError;

  // Só deviceId/mode — NÃO controlledRoles/callbacks/i18n (senão loop infinito)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!deviceId || deviceId === 'default_device') {
        applyRoles({});
        return;
      }
      // Painel advanced controlado: o essential já carregou o estado do pai
      if (isControlled && mode === 'advanced') {
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/automation/hydraulic-roles?device_id=${encodeURIComponent(deviceId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(data.error ?? loadErrorRef.current);
          return;
        }
        applyRoles(normalizeHydraulicRolesJson(data.roles));
      } catch {
        if (!cancelled) toast.error(networkErrorRef.current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [deviceId, mode, isControlled, applyRoles]);

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

  const conflictForRole = useCallback(
    (roleId: HydraulicRoleId): string | null => {
      const binding = roles[roleId];
      if (!binding?.slaveMac) return null;
      const key = `${binding.slaveMac}|${binding.relayIndex}`;
      for (const [id, other] of Object.entries(roles) as [
        HydraulicRoleId,
        HydraulicRoleBinding | undefined,
      ][]) {
        if (id === roleId || !other?.slaveMac) continue;
        if (`${other.slaveMac}|${other.relayIndex}` === key) {
          return `Relé já atribuído a ${id}`;
        }
      }
      return null;
    },
    [roles]
  );

  const updateRole = (roleId: HydraulicRoleId, ref: SlaveRelayRef | null) => {
    const next = { ...roles };
    const binding = refToBinding(ref);
    if (binding) next[roleId] = binding;
    else delete next[roleId];
    applyRoles(next);
  };

  const handleSaveRole = async (roleId: HydraulicRoleId) => {
    if (!deviceId || deviceId === 'default_device') {
      toast.error(p.selectCoreSave);
      return;
    }
    const binding = roles[roleId];
    const def = HYDRAULIC_ROLE_DEFINITIONS.find((d) => d.id === roleId);
    if (def?.required && !binding?.slaveMac) {
      toast.error(p.selectRelayFirst);
      return;
    }
    const conflict = conflictForRole(roleId);
    if (conflict) {
      toast.error(conflict);
      return;
    }

    setSavingRoleId(roleId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/automation/hydraulic-roles', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          device_id: deviceId,
          role_id: roleId,
          binding: binding ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? p.typeSaveError);
        return;
      }
      const next = normalizeHydraulicRolesJson(data.roles);
      applyRoles(next);
      const ruleId = data.rule_id as string | undefined;
      if (ruleId) {
        const friendly = resolveDecisionRuleDisplayName({ rule_id: ruleId }, t);
        toast.success(`${p.typeRoleSaved} · ${friendly} (${p.ruleInactive})`);
      } else {
        toast.success(p.typeRoleSaved);
      }
    } catch {
      toast.error(p.typeNetworkError);
    } finally {
      setSavingRoleId(null);
    }
  };

  const disabled = !deviceId || deviceId === 'default_device' || loading;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 sm:p-6 space-y-4">
      {mode !== 'advanced' && (
        <>
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
          <div className={`rounded-lg border px-3 py-2 text-xs ${HW_BANNER.brand}`}>
            <p className="font-medium">{p.typePerRoleHint}</p>
          </div>
        </>
      )}

      {disabled && (
        <p className="text-sm text-dark-textSecondary">
          {p.selectCoreType}
        </p>
      )}

      <div className="space-y-4">
        {visibleDefs.map((def) => {
          const copy = hydraulicRoleCopy(p, def.id);
          const conflict = conflictForRole(def.id);
          const hasRelay = !!roles[def.id]?.slaveMac;
          const saving = savingRoleId === def.id;
          const canSave =
            !disabled && !savingRoleId && !conflict && hasRelay;

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
                disabled={disabled || !!savingRoleId}
                emptyMessage={p.emptyAtlasRelays}
              />
              {conflict && (
                <p className="text-xs text-amber-300/90">{conflict}</p>
              )}
              <button
                type="button"
                disabled={!canSave}
                onClick={() => void handleSaveRole(def.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-xs font-medium"
              >
                <CloudArrowUpIcon className="w-3.5 h-3.5" />
                {saving ? p.saving : p.saveTypeRole}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
