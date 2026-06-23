/**
 * Estado operacional Auto pH publicado pelo firmware em relay_master.
 * Paridade com useEcOperationState (countdown monotónico + teto de intervalo).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  subscribeRelayStateUpdates,
  type RelayMasterRow,
} from '@/lib/realtime/relay-states';

export type PhOperationState =
  | 'idle'
  | 'dosing'
  | 'recirculating'
  | 'ph_check_pending';

export interface PhOperationSnapshot {
  state: PhOperationState;
  operationRemainingSec: number;
  nextCheckInSec: number;
  syncedAt: number;
}

const FALLBACK_POLL_MS = 5_000;
const STALE_REMAINING_TOLERANCE_SEC = 2;
const ORPHAN_ZERO_REMAINING_MS = 5_000;

type PhOperationRow = RelayMasterRow & {
  ph_operation_state?: string;
  ph_operation_remaining_sec?: number;
  ph_next_check_in_sec?: number;
  last_operation_interrupted?: boolean;
};

function parsePhState(raw: string | undefined): PhOperationState {
  if (
    raw === 'dosing' ||
    raw === 'recirculating' ||
    raw === 'ph_check_pending'
  ) {
    return raw;
  }
  return 'idle';
}

function tickRemaining(snapshot: PhOperationSnapshot, now: number): number {
  const elapsedSec = Math.floor((now - snapshot.syncedAt) / 1000);
  return Math.max(0, snapshot.operationRemainingSec - elapsedSec);
}

function tickNextCheck(snapshot: PhOperationSnapshot, now: number): number {
  const elapsedSec = Math.floor((now - snapshot.syncedAt) / 1000);
  return Math.max(0, snapshot.nextCheckInSec - elapsedSec);
}

function extractPhFields(row: RelayMasterRow) {
  const r = row as PhOperationRow;
  if (r.ph_operation_state === undefined && r.ph_operation_remaining_sec === undefined) {
    return null;
  }
  return {
    state: parsePhState(r.ph_operation_state),
    operationRemainingSec: Math.max(0, Number(r.ph_operation_remaining_sec) || 0),
    nextCheckInSec: Math.max(0, Number(r.ph_next_check_in_sec) || 0),
  };
}

function isStaleRemainingUpdate(
  current: PhOperationSnapshot,
  incomingState: PhOperationState,
  incomingRemaining: number,
  now: number
): boolean {
  if (incomingState !== current.state) return false;
  const currentTick = tickRemaining(current, now);
  return incomingRemaining > currentTick + STALE_REMAINING_TOLERANCE_SEC;
}

function isStaleNextCheckUpdate(
  current: PhOperationSnapshot,
  incomingState: PhOperationState,
  incomingNextCheck: number,
  now: number
): boolean {
  const currentIsCountdown =
    current.state === 'idle' || current.state === 'ph_check_pending';
  const incomingIsCountdown =
    incomingState === 'idle' || incomingState === 'ph_check_pending';
  if (!currentIsCountdown || !incomingIsCountdown) {
    if (incomingState !== current.state) return false;
  }
  const currentTick = tickNextCheck(current, now);
  return incomingNextCheck > currentTick + STALE_REMAINING_TOLERANCE_SEC;
}

function mergeNextCheckMonotonic(
  current: PhOperationSnapshot,
  incomingState: PhOperationState,
  incomingNextCheck: number,
  now: number,
  intervalCeilingSec: number,
  autoEnabled: boolean
): { nextCheckInSec: number; syncedAt: number } {
  const incomingIsCountdown =
    incomingState === 'idle' || incomingState === 'ph_check_pending';

  if (!incomingIsCountdown) {
    return { nextCheckInSec: incomingNextCheck, syncedAt: now };
  }

  const localTick = tickNextCheck(current, now);
  const ceiling =
    intervalCeilingSec > 0
      ? intervalCeilingSec
      : incomingNextCheck > 0
        ? incomingNextCheck
        : current.nextCheckInSec;

  if (incomingNextCheck === 0 && autoEnabled && ceiling > 0) {
    // ph_check_pending com next=0 vem do firmware — não inferir teto artificial
    if (incomingState === 'ph_check_pending') {
      return { nextCheckInSec: 0, syncedAt: now };
    }
    if (localTick > 0) {
      return { nextCheckInSec: current.nextCheckInSec, syncedAt: current.syncedAt };
    }
    return { nextCheckInSec: ceiling, syncedAt: now };
  }

  if (localTick <= 0) {
    return { nextCheckInSec: incomingNextCheck, syncedAt: now };
  }

  if (incomingNextCheck > localTick) {
    const cycleReset =
      localTick <= 2 &&
      ceiling > 0 &&
      incomingNextCheck >= Math.max(ceiling - 2, 1);
    if (cycleReset) {
      return { nextCheckInSec: incomingNextCheck, syncedAt: now };
    }
    return { nextCheckInSec: current.nextCheckInSec, syncedAt: current.syncedAt };
  }

  return { nextCheckInSec: incomingNextCheck, syncedAt: now };
}

function capNextCheckToCeiling(incoming: number, ceiling: number): number {
  if (ceiling > 0 && incoming > ceiling) {
    return ceiling;
  }
  return incoming;
}

function initialSnapshot(): PhOperationSnapshot {
  return {
    state: 'idle',
    operationRemainingSec: 0,
    nextCheckInSec: 0,
    syncedAt: Date.now(),
  };
}

export interface PhRelayFallback {
  relayPhUp: number;
  relayPhDown: number;
  doserRelayStates: boolean[];
}

export interface UsePhOperationStateOptions {
  /** intervalo_auto_ph do formulário — teto e reset de ciclo */
  intervalCeilingSec?: number;
  autoEnabled?: boolean;
  /** Dashboard: mostrar estado real de relay_master mesmo se auto_enabled mudou no form */
  mirrorFirmware?: boolean;
  /** Paridade EC: dosagem visível se relé pH+/pH− activo em relay_master */
  relayFallback?: PhRelayFallback;
}

function isPhRelayDosandoFallback(
  fallback: PhRelayFallback | undefined,
  autoOn: boolean
): boolean {
  if (!autoOn || !fallback || fallback.doserRelayStates.length === 0) {
    return false;
  }
  const isActive = (relay: number) =>
    Number.isFinite(relay) &&
    relay >= 0 &&
    relay < fallback.doserRelayStates.length &&
    fallback.doserRelayStates[relay] === true;
  return isActive(fallback.relayPhUp) || isActive(fallback.relayPhDown);
}

export function usePhOperationState(
  deviceId: string,
  enabled = true,
  options: UsePhOperationStateOptions = {}
) {
  const [snapshot, setSnapshot] = useState<PhOperationSnapshot>(initialSnapshot);
  const [operationInterrupted, setOperationInterrupted] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const snapshotRef = useRef(snapshot);
  const intervalCeilingRef = useRef(options.intervalCeilingSec ?? 0);
  const autoEnabledRef = useRef(options.autoEnabled ?? false);
  const mirrorFirmwareRef = useRef(options.mirrorFirmware ?? false);
  const relayFallbackRef = useRef(options.relayFallback);
  intervalCeilingRef.current = options.intervalCeilingSec ?? 0;
  autoEnabledRef.current = options.autoEnabled ?? false;
  mirrorFirmwareRef.current = options.mirrorFirmware ?? false;
  relayFallbackRef.current = options.relayFallback;
  const zeroRemainingSinceRef = useRef<number | null>(null);

  const applyIdleSnapshot = useCallback(() => {
    const idle: PhOperationSnapshot = {
      state: 'idle',
      operationRemainingSec: 0,
      nextCheckInSec: 0,
      syncedAt: Date.now(),
    };
    snapshotRef.current = idle;
    setSnapshot(idle);
    zeroRemainingSinceRef.current = null;
  }, []);

  const applyRow = useCallback((row: RelayMasterRow) => {
    const r = row as PhOperationRow;
    if (typeof r.last_operation_interrupted === 'boolean') {
      setOperationInterrupted(r.last_operation_interrupted);
    }
    const extracted = extractPhFields(row);
    if (!extracted) return;
    if (
      !mirrorFirmwareRef.current &&
      !autoEnabledRef.current &&
      extracted.state !== 'idle'
    ) {
      return;
    }

    const now = Date.now();
    const current = snapshotRef.current;
    const displayAuto = mirrorFirmwareRef.current || autoEnabledRef.current;

    if (
      isStaleRemainingUpdate(
        current,
        extracted.state,
        extracted.operationRemainingSec,
        now
      )
    ) {
      return;
    }

    const cappedNextCheck = capNextCheckToCeiling(
      extracted.nextCheckInSec,
      intervalCeilingRef.current
    );

    let nextCheckInSec = cappedNextCheck;
    let syncedAt = now;

    if (isStaleNextCheckUpdate(current, extracted.state, cappedNextCheck, now)) {
      const merged = mergeNextCheckMonotonic(
        current,
        extracted.state,
        tickNextCheck(current, now),
        now,
        intervalCeilingRef.current,
        displayAuto
      );
      nextCheckInSec = merged.nextCheckInSec;
      syncedAt = merged.syncedAt;
    } else {
      const merged = mergeNextCheckMonotonic(
        current,
        extracted.state,
        cappedNextCheck,
        now,
        intervalCeilingRef.current,
        displayAuto
      );
      nextCheckInSec = merged.nextCheckInSec;
      syncedAt = merged.syncedAt;
    }

    const next: PhOperationSnapshot = {
      state: extracted.state,
      operationRemainingSec: extracted.operationRemainingSec,
      nextCheckInSec,
      syncedAt,
    };

    if (
      next.state === current.state &&
      next.operationRemainingSec === current.operationRemainingSec &&
      next.nextCheckInSec === current.nextCheckInSec &&
      next.syncedAt === current.syncedAt
    ) {
      return;
    }

    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) return;
    const { data, error } = await supabase
      .from('relay_master')
      .select('device_id, ph_operation_state, ph_operation_remaining_sec, ph_next_check_in_sec, last_operation_interrupted')
      .eq('device_id', deviceId.trim())
      .maybeSingle();
    if (error || !data) return;
    applyRow(data as RelayMasterRow);
  }, [deviceId, enabled, applyRow]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;
    fetchOnce();
    const unsubscribe = subscribeRelayStateUpdates(deviceId.trim(), applyRow, () => {});
    const pollId = setInterval(fetchOnce, FALLBACK_POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(pollId);
    };
  }, [deviceId, enabled, fetchOnce, applyRow]);

  const prevAutoEnabledRef = useRef(options.autoEnabled ?? false);
  useEffect(() => {
    const was = prevAutoEnabledRef.current;
    const now = options.autoEnabled ?? false;
    prevAutoEnabledRef.current = now;
    if (!options.mirrorFirmware && was && !now) {
      applyIdleSnapshot();
    }
    if (!was && now) {
      void fetchOnce();
    }
  }, [options.autoEnabled, options.mirrorFirmware, applyIdleSnapshot, fetchOnce]);

  useEffect(() => {
    const ceiling = options.intervalCeilingSec ?? 0;
    if (ceiling <= 0) return;

    setSnapshot((prev) => {
      if (prev.nextCheckInSec <= ceiling) return prev;
      const next: PhOperationSnapshot = {
        ...prev,
        nextCheckInSec: ceiling,
        syncedAt: Date.now(),
      };
      snapshotRef.current = next;
      return next;
    });
  }, [options.intervalCeilingSec]);

  useEffect(() => {
    const needsTick =
      snapshot.state === 'recirculating' ||
      snapshot.state === 'ph_check_pending' ||
      snapshot.state === 'dosing' ||
      (snapshot.state === 'idle' && snapshot.nextCheckInSec > 0);
    if (!needsTick) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot.state, snapshot.nextCheckInSec]);

  const operationRemainingSec = tickRemaining(snapshot, nowTick);
  const nextCheckInSec = tickNextCheck(snapshot, nowTick);

  useEffect(() => {
    if (snapshot.state !== 'recirculating') {
      zeroRemainingSinceRef.current = null;
      return;
    }
    if (operationRemainingSec > 0) {
      zeroRemainingSinceRef.current = null;
      return;
    }
    const now = Date.now();
    if (zeroRemainingSinceRef.current === null) {
      zeroRemainingSinceRef.current = now;
      return;
    }
    if (now - zeroRemainingSinceRef.current >= ORPHAN_ZERO_REMAINING_MS) {
      applyIdleSnapshot();
    }
  }, [snapshot.state, operationRemainingSec, applyIdleSnapshot]);

  const autoOn =
    (options.mirrorFirmware ?? false) || (options.autoEnabled ?? false);
  const relayDosandoFallback = isPhRelayDosandoFallback(relayFallbackRef.current, autoOn);
  const firmwareDosando = autoOn && snapshot.state === 'dosing';
  const isAguardandoRecirculacao =
    autoOn &&
    snapshot.state === 'recirculating' &&
    operationRemainingSec > 0;
  const isDosando =
    autoOn &&
    (firmwareDosando ||
      (relayDosandoFallback && snapshot.state !== 'recirculating'));

  return {
    state: autoOn ? snapshot.state : 'idle',
    operationRemainingSec: autoOn ? operationRemainingSec : 0,
    nextCheckInSec: autoOn ? nextCheckInSec : 0,
    isDosando,
    isAguardandoRecirculacao,
    isPhCheckPending: autoOn && snapshot.state === 'ph_check_pending',
    operationInterrupted: operationInterrupted && (autoOn ? snapshot.state : 'idle') === 'idle',
  };
}
