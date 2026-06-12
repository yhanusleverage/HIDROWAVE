/**
 * Estado operacional Auto pH publicado pelo firmware em relay_master.
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

type PhOperationRow = RelayMasterRow & {
  ph_operation_state?: string;
  ph_operation_remaining_sec?: number;
  ph_next_check_in_sec?: number;
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

function initialSnapshot(): PhOperationSnapshot {
  return {
    state: 'idle',
    operationRemainingSec: 0,
    nextCheckInSec: 0,
    syncedAt: Date.now(),
  };
}

export interface UsePhOperationStateOptions {
  intervalCeilingSec?: number;
  autoEnabled?: boolean;
}

export function usePhOperationState(
  deviceId: string,
  enabled = true,
  options: UsePhOperationStateOptions = {}
) {
  const [snapshot, setSnapshot] = useState<PhOperationSnapshot>(initialSnapshot);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const snapshotRef = useRef(snapshot);
  const autoEnabledRef = useRef(options.autoEnabled ?? false);
  autoEnabledRef.current = options.autoEnabled ?? false;

  const applyRow = useCallback((row: RelayMasterRow) => {
    const extracted = extractPhFields(row);
    if (!extracted) return;
    if (!autoEnabledRef.current && extracted.state !== 'idle') return;

    const now = Date.now();
    const next: PhOperationSnapshot = {
      state: extracted.state,
      operationRemainingSec: extracted.operationRemainingSec,
      nextCheckInSec: extracted.nextCheckInSec,
      syncedAt: now,
    };
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) return;
    const { data, error } = await supabase
      .from('relay_master')
      .select('device_id, ph_operation_state, ph_operation_remaining_sec, ph_next_check_in_sec')
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
  const autoOn = options.autoEnabled ?? false;

  return {
    state: autoOn ? snapshot.state : 'idle',
    operationRemainingSec: autoOn ? operationRemainingSec : 0,
    nextCheckInSec: autoOn ? nextCheckInSec : 0,
    isDosando: autoOn && snapshot.state === 'dosing',
    isAguardandoRecirculacao: autoOn && snapshot.state === 'recirculating' && operationRemainingSec > 0,
    isPhCheckPending: autoOn && snapshot.state === 'ph_check_pending',
  };
}
