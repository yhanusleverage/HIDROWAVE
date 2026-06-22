/**
 * Estado operacional Auto EC publicado pelo firmware em relay_master.
 * Substitui simulação React local (flancos de relé + debounce hardcoded).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  subscribeRelayStateUpdates,
  type RelayMasterRow,
} from '@/lib/realtime/relay-states';

export type EcOperationState =
  | 'idle'
  | 'dosing'
  | 'waiting_nutrient'
  | 'recirculating'
  | 'ec_check_pending'
  | 'diluting_draining'
  | 'diluting_filling';

export interface EcOperationSnapshot {
  state: EcOperationState;
  operationRemainingSec: number;
  nextCheckInSec: number;
  syncedAt: number;
}

const FALLBACK_POLL_MS = 5_000;
const STALE_REMAINING_TOLERANCE_SEC = 2;
const ORPHAN_ZERO_REMAINING_MS = 5_000; // recirc huérfano (MQTT manual) → idle local

function clearLegacySessionSnapshot(deviceId: string) {
  if (typeof window === 'undefined' || !deviceId?.trim()) return;
  try {
    sessionStorage.removeItem(`hidrowave-ec-op:${deviceId.trim()}`);
  } catch {
    /* quota / private mode */
  }
}

type EcOperationRow = RelayMasterRow & {
  ec_operation_state?: string;
  ec_operation_remaining_sec?: number;
  ec_next_check_in_sec?: number;
  ec_dilution_target_l?: number;
  ec_dilution_progress_l?: number;
};

function parseEcState(raw: string | undefined): EcOperationState {
  if (
    raw === 'dosing' ||
    raw === 'waiting_nutrient' ||
    raw === 'recirculating' ||
    raw === 'ec_check_pending' ||
    raw === 'diluting_draining' ||
    raw === 'diluting_filling'
  ) {
    return raw;
  }
  return 'idle';
}

function tickRemaining(snapshot: EcOperationSnapshot, now: number): number {
  const elapsedSec = Math.floor((now - snapshot.syncedAt) / 1000);
  return Math.max(0, snapshot.operationRemainingSec - elapsedSec);
}

function tickNextCheck(snapshot: EcOperationSnapshot, now: number): number {
  const elapsedSec = Math.floor((now - snapshot.syncedAt) / 1000);
  return Math.max(0, snapshot.nextCheckInSec - elapsedSec);
}

function extractEcFields(row: RelayMasterRow): {
  hasEcFields: boolean;
  state: EcOperationState;
  operationRemainingSec: number;
  nextCheckInSec: number;
} | null {
  const r = row as EcOperationRow;
  if (r.ec_operation_state === undefined && r.ec_operation_remaining_sec === undefined) {
    return null;
  }

  return {
    hasEcFields: true,
    state: parseEcState(r.ec_operation_state),
    operationRemainingSec: Math.max(0, Number(r.ec_operation_remaining_sec) || 0),
    nextCheckInSec: Math.max(0, Number(r.ec_next_check_in_sec) || 0),
  };
}

function isStaleRemainingUpdate(
  current: EcOperationSnapshot,
  incomingState: EcOperationState,
  incomingRemaining: number,
  now: number
): boolean {
  if (incomingState !== current.state) {
    return false;
  }
  const currentTick = tickRemaining(current, now);
  return incomingRemaining > currentTick + STALE_REMAINING_TOLERANCE_SEC;
}

function isStaleNextCheckUpdate(
  current: EcOperationSnapshot,
  incomingState: EcOperationState,
  incomingNextCheck: number,
  now: number
): boolean {
  const currentIsCountdown =
    current.state === 'idle' || current.state === 'ec_check_pending';
  const incomingIsCountdown =
    incomingState === 'idle' || incomingState === 'ec_check_pending';
  if (!currentIsCountdown || !incomingIsCountdown) {
    if (incomingState !== current.state) {
      return false;
    }
  }
  const currentTick = tickNextCheck(current, now);
  return incomingNextCheck > currentTick + STALE_REMAINING_TOLERANCE_SEC;
}

/** Countdown de próxima verificação: nunca salta para cima (poll MQTT/Realtime). */
function mergeNextCheckMonotonic(
  current: EcOperationSnapshot,
  incomingState: EcOperationState,
  incomingNextCheck: number,
  now: number,
  intervalCeilingSec: number,
  autoEnabled: boolean
): { nextCheckInSec: number; syncedAt: number } {
  const incomingIsCountdown =
    incomingState === 'idle' || incomingState === 'ec_check_pending';

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

function initialSnapshot(): EcOperationSnapshot {
  return {
    state: 'idle',
    operationRemainingSec: 0,
    nextCheckInSec: 0,
    syncedAt: Date.now(),
  };
}

export interface UseEcOperationStateOptions {
  /** intervalo_auto_ec do formulário — fallback e teto de reset de ciclo */
  intervalCeilingSec?: number;
  autoEnabled?: boolean;
  /** Dashboard: mostrar estado real de relay_master mesmo se auto_enabled mudou no form */
  mirrorFirmware?: boolean;
}

function capNextCheckToCeiling(incoming: number, ceiling: number): number {
  if (ceiling > 0 && incoming > ceiling) {
    return ceiling;
  }
  return incoming;
}

export function useEcOperationState(
  deviceId: string,
  enabled = true,
  options: UseEcOperationStateOptions = {}
) {
  const [snapshot, setSnapshot] = useState<EcOperationSnapshot>(initialSnapshot);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const snapshotRef = useRef(snapshot);
  const deviceIdRef = useRef(deviceId);
  const zeroRemainingSinceRef = useRef<number | null>(null);
  const intervalCeilingRef = useRef(options.intervalCeilingSec ?? 0);
  const autoEnabledRef = useRef(options.autoEnabled ?? false);
  const mirrorFirmwareRef = useRef(options.mirrorFirmware ?? false);
  deviceIdRef.current = deviceId;
  intervalCeilingRef.current = options.intervalCeilingSec ?? 0;
  autoEnabledRef.current = options.autoEnabled ?? false;
  mirrorFirmwareRef.current = options.mirrorFirmware ?? false;

  const applyIdleSnapshot = useCallback(() => {
    const idle: EcOperationSnapshot = {
      state: 'idle',
      operationRemainingSec: 0,
      nextCheckInSec: 0,
      syncedAt: Date.now(),
    };
    snapshotRef.current = idle;
    setSnapshot(idle);
    zeroRemainingSinceRef.current = null;
    clearLegacySessionSnapshot(deviceIdRef.current);
  }, []);

  const applyRow = useCallback((row: RelayMasterRow) => {
    const extracted = extractEcFields(row);
    if (!extracted) {
      return;
    }

    const now = Date.now();
    const current = snapshotRef.current;

    if (
      !mirrorFirmwareRef.current &&
      !autoEnabledRef.current &&
      extracted.state !== 'idle' &&
      extracted.state !== 'diluting_draining' &&
      extracted.state !== 'diluting_filling'
    ) {
      return;
    }

    const cappedNextCheck = capNextCheckToCeiling(
      extracted.nextCheckInSec,
      intervalCeilingRef.current
    );

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

    let nextCheckInSec = cappedNextCheck;
    let syncedAt = now;

    const displayAuto =
      mirrorFirmwareRef.current || autoEnabledRef.current;

    if (
      isStaleNextCheckUpdate(current, extracted.state, cappedNextCheck, now)
    ) {
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

    const next: EcOperationSnapshot = {
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
      .select(
        'device_id, ec_operation_state, ec_operation_remaining_sec, ec_next_check_in_sec, doser_relay_states'
      )
      .eq('device_id', deviceId.trim())
      .maybeSingle();

    if (error || !data) return;
    applyRow(data as RelayMasterRow);
  }, [deviceId, enabled, applyRow]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;

    clearLegacySessionSnapshot(deviceId);
    fetchOnce();

    const unsubscribe = subscribeRelayStateUpdates(
      deviceId.trim(),
      applyRow,
      () => {}
    );

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
  }, [options.autoEnabled, options.mirrorFirmware, applyIdleSnapshot]);

  useEffect(() => {
    const ceiling = options.intervalCeilingSec ?? 0;
    if (ceiling <= 0) return;

    setSnapshot((prev) => {
      if (prev.nextCheckInSec <= ceiling) return prev;
      const next: EcOperationSnapshot = {
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
      snapshot.state === 'ec_check_pending' ||
      snapshot.state === 'dosing' ||
      snapshot.state === 'waiting_nutrient' ||
      snapshot.state === 'diluting_draining' ||
      snapshot.state === 'diluting_filling' ||
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

  const isAguardandoRecirculacao =
    snapshot.state === 'recirculating' && operationRemainingSec > 0;

  const autoOn =
    (options.mirrorFirmware ?? false) || (options.autoEnabled ?? false);

  const isDilutionState =
    snapshot.state === 'diluting_draining' ||
    snapshot.state === 'diluting_filling';

  const displayState = autoOn || isDilutionState ? snapshot.state : 'idle';

  return {
    state: displayState,
    operationRemainingSec:
      autoOn || isDilutionState ? operationRemainingSec : 0,
    nextCheckInSec: autoOn ? nextCheckInSec : 0,
    /** Secuencia activa: dosing o pausa corta entre nutrientes (sin badge aparte) */
    isDosando:
      autoOn &&
      (snapshot.state === 'dosing' || snapshot.state === 'waiting_nutrient'),
    isAguardandoRecirculacao: autoOn && isAguardandoRecirculacao,
    isEcCheckPending: autoOn && snapshot.state === 'ec_check_pending',
    isDiluting: isDilutionState,
    isDraining: snapshot.state === 'diluting_draining',
    isReplacing: snapshot.state === 'diluting_filling',
  };
}
