'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getMasterLocalRelayNames } from '@/lib/nutrition-plan';
import { subscribeRelayStateUpdates, type RelayMasterRow } from '@/lib/realtime/relay-states';
import {
  subscribeRelayCommandRegistryUpdates,
  PENDING_COMMAND_STATUSES,
  PENDING_COMMAND_STATUS_LIST,
  type RelayCommandRow,
} from '@/lib/realtime/relay-commands';
import {
  buildRegistryFromConfigs,
  getSelectableRelays,
  getRelayConflicts,
  formatRelayConflictMessage,
  serializeRegistryForDebug,
  validateEcNutrientsAssignment,
  type RelayAllocationRegistry,
  type RelaySelectContext,
  type RelayOption,
  type PhConfigRelaySlice,
  type EcConfigRelaySlice,
  type EcNutrientRelaySlice,
  type DecisionRuleRelaySlice,
} from '@/lib/relay-allocation';

const IDLE_POLL_MS = 60_000;
const PENDING_POLL_MS = 5_000;

type PendingCommandSlice = {
  id?: number | string;
  relay_number?: number;
  status?: string;
  created_at?: string;
  sent_at?: string;
  duration_seconds?: number | null;
};

export interface UseRelayAllocationOptions {
  enabled?: boolean;
  /** Relé em teste na calibragem (claim temporário UI) */
  calibragemRelay?: number | null;
}

export function useRelayAllocation(
  deviceId: string,
  options: UseRelayAllocationOptions = {}
) {
  const enabled = Boolean(options.enabled && deviceId?.trim());
  const calibragemRelay = options.calibragemRelay ?? null;

  const [isLoading, setIsLoading] = useState(false);
  const [phConfig, setPhConfig] = useState<PhConfigRelaySlice | null>(null);
  const [ecConfig, setEcConfig] = useState<EcConfigRelaySlice | null>(null);
  const [relayNames, setRelayNames] = useState<Map<number, string>>(new Map());
  const [doserRelayStates, setDoserRelayStates] = useState<boolean[]>([]);
  const [doserRelayHasTimers, setDoserRelayHasTimers] = useState<boolean[]>([]);
  const [decisionRules, setDecisionRules] = useState<DecisionRuleRelaySlice[]>([]);
  const [pendingCommands, setPendingCommands] = useState<PendingCommandSlice[]>([]);

  const fetchPendingCommands = useCallback(async () => {
    if (!deviceId?.trim()) return;
    const cmdsRes = await supabase
      .from('relay_commands')
      .select('id, relay_number, status, created_at, sent_at, duration_seconds')
      .eq('device_id', deviceId.trim())
      .in('status', [...PENDING_COMMAND_STATUS_LIST]);
    if (!cmdsRes.error && cmdsRes.data) {
      setPendingCommands(cmdsRes.data as PendingCommandSlice[]);
    }
  }, [deviceId]);

  const applyCommandRow = useCallback((row: RelayCommandRow) => {
    const status = (row.status || '').toLowerCase();
    setPendingCommands((prev) => {
      const without = prev.filter((c) => String(c.id) !== String(row.id));
      if (PENDING_COMMAND_STATUSES.has(status)) {
        return [
          ...without,
          {
            id: row.id,
            relay_number: row.relay_number ?? undefined,
            status: row.status ?? undefined,
            created_at: row.created_at ?? undefined,
            sent_at: row.sent_at ?? undefined,
            duration_seconds: row.duration_seconds ?? undefined,
          },
        ];
      }
      return without;
    });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!deviceId?.trim()) return;
    setIsLoading(true);
    try {
      const id = encodeURIComponent(deviceId.trim());
      const [phRes, ecRes, names, masterRes, rulesRes] = await Promise.all([
        fetch(`/api/ph-controller/config?device_id=${id}`),
        fetch(`/api/ec-controller/config?device_id=${id}`),
        getMasterLocalRelayNames(deviceId.trim()),
        supabase
          .from('relay_master')
          .select('doser_relay_states, doser_relay_has_timers')
          .eq('device_id', deviceId.trim())
          .maybeSingle(),
        supabase
          .from('decision_rules')
          .select('id, rule_name, enabled, rule_json')
          .eq('device_id', deviceId.trim()),
      ]);

      if (phRes.ok) {
        setPhConfig((await phRes.json()) as PhConfigRelaySlice);
      }
      if (ecRes.ok) {
        setEcConfig((await ecRes.json()) as EcConfigRelaySlice);
      }
      setRelayNames(names);

      const master = masterRes.data;
      if (master) {
        setDoserRelayStates(master.doser_relay_states || []);
        setDoserRelayHasTimers(master.doser_relay_has_timers || []);
      }

      if (!rulesRes.error && rulesRes.data) {
        setDecisionRules(rulesRes.data as DecisionRuleRelaySlice[]);
      }

      await fetchPendingCommands();
    } catch (err) {
      console.warn('[useRelayAllocation] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, fetchPendingCommands]);

  const applyMasterRow = useCallback((row: RelayMasterRow) => {
    if (row.doser_relay_states?.length) {
      setDoserRelayStates(row.doser_relay_states);
    }
    if (row.doser_relay_has_timers?.length) {
      setDoserRelayHasTimers(row.doser_relay_has_timers);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchAll();
    const unsubRelay = subscribeRelayStateUpdates(deviceId.trim(), applyMasterRow, () => {});
    const unsubCmds = subscribeRelayCommandRegistryUpdates(deviceId.trim(), applyCommandRow);
    return () => {
      unsubRelay();
      unsubCmds();
    };
  }, [enabled, deviceId, fetchAll, applyMasterRow, applyCommandRow]);

  useEffect(() => {
    if (!enabled) return;
    const pollMs = pendingCommands.length > 0 ? PENDING_POLL_MS : IDLE_POLL_MS;
    const cmdPoll = setInterval(fetchPendingCommands, pollMs);
    return () => clearInterval(cmdPoll);
  }, [enabled, deviceId, pendingCommands.length, fetchPendingCommands]);

  const registry: RelayAllocationRegistry = useMemo(
    () =>
      buildRegistryFromConfigs({
        phConfig,
        ecConfig,
        relayNames,
        relayRuntime: {
          doser_relay_states: doserRelayStates,
          doser_relay_has_timers: doserRelayHasTimers,
        },
        decisionRules,
        pendingCommands,
        calibragemRelay,
      }),
    [
      phConfig,
      ecConfig,
      relayNames,
      doserRelayStates,
      doserRelayHasTimers,
      decisionRules,
      pendingCommands,
      calibragemRelay,
    ]
  );

  const getSelectable = useCallback(
    (context: RelaySelectContext): RelayOption[] => getSelectableRelays(registry, context),
    [registry]
  );

  const getConflictMessage = useCallback(
    (context: RelaySelectContext): string | null =>
      formatRelayConflictMessage(registry, context.currentValue, context),
    [registry]
  );

  const getConflicts = useCallback(
    (context: RelaySelectContext) => getRelayConflicts(registry, context.currentValue, context),
    [registry]
  );

  const debugSnapshot = useCallback(
    (context?: RelaySelectContext) => serializeRegistryForDebug(registry, context),
    [registry]
  );

  const buildRegistry = useCallback(
    (overrides?: Partial<import('@/lib/relay-allocation').BuildRegistryInput>) =>
      buildRegistryFromConfigs({
        phConfig: overrides?.phConfig ?? phConfig,
        ecConfig: overrides?.ecConfig ?? ecConfig,
        relayNames: overrides?.relayNames ?? relayNames,
        relayRuntime: overrides?.relayRuntime ?? {
          doser_relay_states: doserRelayStates,
          doser_relay_has_timers: doserRelayHasTimers,
        },
        decisionRules: overrides?.decisionRules ?? decisionRules,
        pendingCommands: overrides?.pendingCommands ?? pendingCommands,
        calibragemRelay: overrides?.calibragemRelay ?? calibragemRelay,
      }),
    [
      phConfig,
      ecConfig,
      relayNames,
      doserRelayStates,
      doserRelayHasTimers,
      decisionRules,
      pendingCommands,
      calibragemRelay,
    ]
  );

  return {
    registry,
    isLoading,
    refresh: fetchAll,
    buildRegistry,
    getSelectableRelays: getSelectable,
    getConflictMessage,
    getConflicts,
    debugSnapshot,
    pendingCommands,
    phConfig,
    ecConfig,
    /** Valida nutrientes EC vs relés pH (cache UI; API valida ph_config_view na DB). */
    validateEcSave: (
      nutrients: EcNutrientRelaySlice[] | null | undefined,
      phOverride?: { relay_ph_up?: number; relay_ph_down?: number } | null
    ) =>
      validateEcNutrientsAssignment(nutrients, {
        relay_ph_up: phOverride?.relay_ph_up ?? phConfig?.relay_ph_up,
        relay_ph_down: phOverride?.relay_ph_down ?? phConfig?.relay_ph_down,
      }),
  };
}
