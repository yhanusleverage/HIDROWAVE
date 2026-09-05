'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hwToast } from '@/lib/control-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const SAFETY_HOLD_SEC = 120;

async function sendRelayInstant(params: {
  masterDeviceId: string;
  relayNumber: number;
  action: 'on' | 'off';
  durationSeconds?: number | null;
}): Promise<boolean> {
  const res = await fetch('/api/esp-now/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      master_device_id: params.masterDeviceId,
      relay_number: params.relayNumber,
      action: params.action,
      duration_seconds: params.durationSeconds ?? null,
      mode: 'instant',
      created_by: 'calibragem_prime',
      command_type: 'manual',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === 'string' ? err.error : `HTTP ${res.status}`
    );
  }
  return true;
}

export function PumpPrimeHoldControl({
  deviceId,
  relayNumber,
  relayLabel,
  isOnline,
  autoBlocked,
  accent = 'ec',
}: {
  deviceId: string;
  relayNumber: number;
  relayLabel?: string;
  isOnline: boolean;
  autoBlocked: boolean;
  accent?: 'ec' | 'ph';
}) {
  const { t } = useLanguage();
  const p = t.calibragem.prime;
  const [holding, setHolding] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const holdingRef = useRef(false);
  const holdStartRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const accentBtn = accent === 'ph'
    ? 'border-violet-500/50 bg-violet-500/15 text-violet-200 active:bg-violet-500/40'
    : 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200 active:bg-cyan-500/40';
  const accentLive = accent === 'ph' ? 'text-violet-300' : 'text-cyan-300';

  const stopPrime = useCallback(
    async (silent = false) => {
      seqRef.current += 1;
      if (!holdingRef.current) return;
      holdingRef.current = false;
      setHolding(false);
      pointerIdRef.current = null;
      try {
        await sendRelayInstant({
          masterDeviceId: deviceId,
          relayNumber,
          action: 'off',
        });
        if (!silent) {
          hwToast.info(p.toastStopped, 'CALIBRAGEM');
        }
      } catch (e) {
        hwToast.error(
          e instanceof Error ? e.message : p.toastStopFail,
          'CALIBRAGEM'
        );
      }
    },
    [deviceId, relayNumber, p.toastStopped, p.toastStopFail]
  );

  const startPrime = useCallback(async () => {
    if (holdingRef.current) return;
    if (!isOnline) {
      hwToast.error(p.toastOffline, 'CALIBRAGEM');
      return;
    }
    if (autoBlocked) {
      hwToast.error(p.toastDisableAuto, 'CALIBRAGEM');
      return;
    }
    const seq = ++seqRef.current;
    holdingRef.current = true;
    holdStartRef.current = Date.now();
    setHolding(true);
    setElapsedSec(0);
    try {
      await sendRelayInstant({
        masterDeviceId: deviceId,
        relayNumber,
        action: 'on',
        durationSeconds: SAFETY_HOLD_SEC,
      });
      if (seqRef.current !== seq) {
        await sendRelayInstant({
          masterDeviceId: deviceId,
          relayNumber,
          action: 'off',
        });
      }
    } catch (e) {
      if (seqRef.current === seq) {
        holdingRef.current = false;
        setHolding(false);
      }
      hwToast.error(
        e instanceof Error ? e.message : p.toastPrimeFail,
        'CALIBRAGEM'
      );
    }
  }, [autoBlocked, deviceId, isOnline, relayNumber, p.toastOffline, p.toastDisableAuto, p.toastPrimeFail]);

  useEffect(() => {
    if (!holding) return;
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - holdStartRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [holding]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void stopPrime(true);
      }
    };
    const onPageHide = () => {
      void stopPrime(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void stopPrime(true);
    };
  }, [stopPrime]);

  const disabled = !isOnline || autoBlocked || !deviceId;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    void startPrime();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    void stopPrime();
  };

  const title = autoBlocked
    ? p.titleAuto
    : !isOnline
      ? p.titleOffline
      : p.titleHold;

  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-dark-text">{p.title}</p>
        <span className={`text-xs font-mono ${holding ? accentLive : 'text-dark-textSecondary'}`}>
          {holding ? p.priming.replace('{n}', String(elapsedSec)) : p.stopped}
        </span>
      </div>
      {relayLabel ? (
        <p className="text-xs text-dark-textSecondary">{relayLabel}</p>
      ) : null}
      <p className="text-xs text-dark-textSecondary">{p.hint}</p>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`w-full py-4 rounded-lg border font-semibold select-none touch-none disabled:opacity-40 disabled:cursor-not-allowed ${
          holding ? 'ring-2 ring-offset-0 ring-white/20 ' : ''
        } ${accentBtn}`}
      >
        {holding ? p.release : p.hold}
      </button>
      {autoBlocked ? (
        <p className="text-xs text-amber-400">{p.autoBanner}</p>
      ) : null}
      {!isOnline ? (
        <p className="text-xs text-amber-400">{p.toastOffline}</p>
      ) : null}
    </div>
  );
}
