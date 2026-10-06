'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DOSER_NAME_CHANNEL,
  getMasterLocalRelayNames,
  type DoserNameUpdate,
} from '@/lib/nutrition-plan';
import { subscribeRelayStateUpdates, type RelayMasterRow } from '@/lib/realtime/relay-states';
import {
  subscribeRelayCommandRegistryUpdates,
  PENDING_COMMAND_STATUSES,
  PENDING_COMMAND_STATUS_LIST,
  type RelayCommandRow,
} from '@/lib/realtime/relay-commands';
import { createRealtimeChannel } from '@/lib/realtime/channel';
import {
  applyNutrientSolutionNames,
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
const NAMES_REFRESH_MS = 200;

function sameNameMap(a: Map<number, string>, b: Map<number, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [relay, name] of b) {
    if (a.get(relay) !== name) return false;
  }
  return true;
}

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
  const namesRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const namesRefreshSeqRef = useRef(0);
  const masterNamesRef = useRef<Map<number, string>>(new Map());
  const serverNutrientsRef = useRef<unknown>([]);

  const publishComposedNames = useCallback(() => {
    const composed = applyNutrientSolutionNames(
      masterNamesRef.current,
      serverNutrientsRef.current
    );
    setRelayNames((prev) => (sameNameMap(prev, composed) ? prev : composed));
  }, []);

  const refreshRelayNames = useCallback(async () => {
    const id = deviceId?.trim();
    if (!id) return;
    const seq = ++namesRefreshSeqRef.current;
    try {
      const names = await getMasterLocalRelayNames(id);
      if (seq !== namesRefreshSeqRef.current) return;
      masterNamesRef.current = names;
      publishComposedNames();
    } catch (err) {
      console.warn('[useRelayAllocation] names refresh', err);
    }
  }, [deviceId, publishComposedNames]);

  const scheduleRelayNamesRefresh = useCallback(() => {
    if (namesRefreshTimerRef.current) clearTimeout(namesRefreshTimerRef.current);
    namesRefreshTimerRef.current = setTimeout(() => {
      namesRefreshTimerRef.current = null;
      void refreshRelayNames();
    }, NAMES_REFRESH_MS);
  }, [refreshRelayNames]);

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
        setPhConfig((await phRes.json().catch(() => ({}))) as PhConfigRelaySlice);
      }
      if (ecRes.ok) {
        const ec = (await ecRes.json().catch(() => ({}))) as EcConfigRelaySlice;
        serverNutrientsRef.current = ec.nutrients ?? [];
        setEcConfig(ec);
      }
      masterNamesRef.current = names;
      publishComposedNames();

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
  }, [deviceId, fetchPendingCommands, publishComposedNames]);

  const applyMasterRow = useCallback((row: RelayMasterRow) => {
    if (row.doser_relay_states?.length) {
      setDoserRelayStates(row.doser_relay_states);
    }
    if (row.doser_relay_has_timers?.length) {
      setDoserRelayHasTimers(row.doser_relay_has_timers);
    }
    if (Array.isArray(row.doser_relay_names)) {
      const incoming = row.doser_relay_names;
      const next = new Map(masterNamesRef.current);
      for (let i = 0; i <= 7; i++) {
        const raw = incoming[i];
        const name = raw && String(raw).trim() ? String(raw).trim() : '';
        if (name) next.set(i, name);
        else next.delete(i);
      }
      masterNamesRef.current = next;
      publishComposedNames();
    }
    // El estado del relé a menudo llega sin doser_relay_names (columna TOAST sin cambios).
    // Releer la fila confirma el nombre guardado en Calibragem sin poner loading.
    scheduleRelayNamesRefresh();
  }, [publishComposedNames, scheduleRelayNamesRefresh]);

  useEffect(() => {
    if (!enabled) return;
    fetchAll();
    const unsubRelay = subscribeRelayStateUpdates(deviceId.trim(), applyMasterRow, () => {});
    const unsubCmds = subscribeRelayCommandRegistryUpdates(deviceId.trim(), applyCommandRow);
    return () => {
      unsubRelay();
      unsubCmds();
      if (namesRefreshTimerRef.current) {
        clearTimeout(namesRefreshTimerRef.current);
        namesRefreshTimerRef.current = null;
      }
    };
  }, [enabled, deviceId, fetchAll, applyMasterRow, applyCommandRow]);

  useEffect(() => {
    if (!enabled) return;
    const id = deviceId.trim();
    const apply = (update: DoserNameUpdate) => {
      if (!update || update.deviceId !== id) return;
      const relay = update.relayNumber;
      if (!Number.isInteger(relay) || relay < 0 || relay > 7) return;
      const name = (update.relayName || '').trim();
      const next = new Map(masterNamesRef.current);
      if (name) next.set(relay, name);
      else next.delete(relay);
      masterNamesRef.current = next;
      publishComposedNames();
    };
    const onWindow = (event: Event) => {
      apply((event as CustomEvent<DoserNameUpdate>).detail);
    };
    window.addEventListener(DOSER_NAME_CHANNEL, onWindow);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DOSER_NAME_CHANNEL);
      channel.onmessage = (event: MessageEvent<DoserNameUpdate>) => apply(event.data);
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener(DOSER_NAME_CHANNEL, onWindow);
      channel?.close();
    };
  }, [enabled, deviceId, publishComposedNames]);

  useEffect(() => {
    if (!enabled) return;
    const id = deviceId.trim();
    let cancelled = false;
    const refreshNutrientNames = async () => {
      try {
        const res = await fetch(
          `/api/ec-controller/config?device_id=${encodeURIComponent(id)}`
        );
        if (!res.ok || cancelled) return;
        const ec = (await res.json().catch(() => ({}))) as EcConfigRelaySlice;
        if (cancelled) return;
        serverNutrientsRef.current = ec.nutrients ?? [];
        setEcConfig(ec);
        publishComposedNames();
      } catch (err) {
        console.warn('[useRelayAllocation] nutrient names', err);
      }
    };
    const channel = createRealtimeChannel(`hidrowave-ec-pump-names-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ec_config_view', filter: `device_id=eq.${id}` },
        () => {
          void refreshNutrientNames();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, deviceId, publishComposedNames]);

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
