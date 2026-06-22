'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  subscribeRelayStateUpdates,
  type RelayMasterRow,
} from '@/lib/realtime/relay-states';

export type EcDilutionOperationState =
  | 'idle'
  | 'diluting_draining'
  | 'diluting_filling'
  | 'recirculating';

export interface EcDilutionStateSnapshot {
  state: EcDilutionOperationState;
  operationRemainingSec: number;
  targetL: number;
  progressL: number;
  syncedAt: number;
}

const FALLBACK_POLL_MS = 5_000;

type DilutionRow = RelayMasterRow & {
  ec_operation_state?: string;
  ec_operation_remaining_sec?: number;
  ec_dilution_target_l?: number;
  ec_dilution_progress_l?: number;
};

function parseState(raw: string | undefined): EcDilutionOperationState {
  if (raw === 'diluting_draining' || raw === 'diluting_filling') {
    return raw;
  }
  if (raw === 'recirculating') return 'recirculating';
  return 'idle';
}

function tickRemaining(snapshot: EcDilutionStateSnapshot, now: number): number {
  const elapsedSec = Math.floor((now - snapshot.syncedAt) / 1000);
  return Math.max(0, snapshot.operationRemainingSec - elapsedSec);
}

function extractFields(row: RelayMasterRow): EcDilutionStateSnapshot | null {
  const r = row as DilutionRow;
  if (r.ec_operation_state === undefined) return null;

  return {
    state: parseState(r.ec_operation_state),
    operationRemainingSec: Math.max(0, Number(r.ec_operation_remaining_sec) || 0),
    targetL: Math.max(0, Number(r.ec_dilution_target_l) || 0),
    progressL: Math.max(0, Number(r.ec_dilution_progress_l) || 0),
    syncedAt: Date.now(),
  };
}

const INITIAL: EcDilutionStateSnapshot = {
  state: 'idle',
  operationRemainingSec: 0,
  targetL: 0,
  progressL: 0,
  syncedAt: Date.now(),
};

export interface UseEcDilutionStateOptions {
  dilutionAutoEnabled?: boolean;
  /** Dashboard: mostrar estado real mesmo se toggle local desligado */
  mirrorFirmware?: boolean;
}

export function useEcDilutionState(
  deviceId: string,
  enabled = true,
  options: UseEcDilutionStateOptions = {}
) {
  const [snapshot, setSnapshot] = useState<EcDilutionStateSnapshot>(INITIAL);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const snapshotRef = useRef(snapshot);
  const autoRef = useRef(options.dilutionAutoEnabled ?? false);
  const mirrorRef = useRef(options.mirrorFirmware ?? false);
  autoRef.current = options.dilutionAutoEnabled ?? false;
  mirrorRef.current = options.mirrorFirmware ?? false;

  const applyRow = useCallback((row: RelayMasterRow) => {
    const extracted = extractFields(row);
    if (!extracted) return;

    const isDiluting =
      extracted.state === 'diluting_draining' ||
      extracted.state === 'diluting_filling';

    if (!mirrorRef.current && !autoRef.current && isDiluting) {
      return;
    }

    snapshotRef.current = extracted;
    setSnapshot(extracted);
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!enabled || !deviceId?.trim()) return;

    const { data, error } = await supabase
      .from('relay_master')
      .select(
        'device_id, ec_operation_state, ec_operation_remaining_sec, ec_dilution_target_l, ec_dilution_progress_l'
      )
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
    const active =
      snapshot.state === 'diluting_draining' ||
      snapshot.state === 'diluting_filling' ||
      (snapshot.state === 'recirculating' && snapshot.operationRemainingSec > 0);

    if (!active) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [snapshot.state, snapshot.operationRemainingSec]);

  const operationRemainingSec = tickRemaining(snapshot, nowTick);
  const displayOn = mirrorRef.current || autoRef.current;

  const isDraining =
    displayOn && snapshot.state === 'diluting_draining';
  const isFilling =
    displayOn && snapshot.state === 'diluting_filling';
  const isDiluting = isDraining || isFilling;

  const progressRatio =
    snapshot.targetL > 0
      ? Math.min(1, snapshot.progressL / snapshot.targetL)
      : 0;

  return {
    state: displayOn ? snapshot.state : 'idle',
    isDraining,
    isFilling,
    isDiluting,
    operationRemainingSec: displayOn ? operationRemainingSec : 0,
    targetL: snapshot.targetL,
    progressL: snapshot.progressL,
    progressRatio,
  };
}
