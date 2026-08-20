'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hwToast } from '@/lib/control-toast';

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
          hwToast.info('Cebado parado', 'CEBAR');
        }
      } catch (e) {
        hwToast.error(
          e instanceof Error ? e.message : 'Falha ao parar bomba',
          'CEBAR'
        );
      }
    },
    [deviceId, relayNumber]
  );

  const startPrime = useCallback(async () => {
    if (holdingRef.current) return;
    if (!isOnline) {
      hwToast.error('Core offline — cebar precisa de MQTT', 'CEBAR');
      return;
    }
    if (autoBlocked) {
      hwToast.error('Desative o Auto para cebar', 'CEBAR');
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
        e instanceof Error ? e.message : 'Falha ao cebar',
        'CEBAR'
      );
    }
  }, [autoBlocked, deviceId, isOnline, relayNumber]);

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
    ? 'Desative o Auto para cebar'
    : !isOnline
      ? 'Core offline'
      : 'Mantenha apertado para cebar; solte para parar';

  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-dark-text">Cebar / purgar</p>
        <span className={`text-xs font-mono ${holding ? accentLive : 'text-dark-textSecondary'}`}>
          {holding ? `CEBANDO ${elapsedSec}s` : 'PARADA'}
        </span>
      </div>
      {relayLabel ? (
        <p className="text-xs text-dark-textSecondary">{relayLabel}</p>
      ) : null}
      <p className="text-xs text-dark-textSecondary">
        Mantenha o botão: bomba ON. Solte: para por completo. MQTT (quase tempo real).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          title={title}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`flex-1 py-4 rounded-lg border font-semibold select-none touch-none disabled:opacity-40 disabled:cursor-not-allowed ${
            holding ? 'ring-2 ring-offset-0 ring-white/20 ' : ''
          } ${accentBtn}`}
        >
          {holding ? 'Solte para parar' : 'Manter para cebar'}
        </button>
        <button
          type="button"
          onClick={() => void stopPrime()}
          className="px-3 py-4 rounded-lg border border-red-500/40 text-red-300 text-sm hover:bg-red-500/10"
        >
          Parar
        </button>
      </div>
      {autoBlocked ? (
        <p className="text-xs text-amber-400">Auto ligado — desative em Automação para cebar.</p>
      ) : null}
      {!isOnline ? (
        <p className="text-xs text-amber-400">Core offline — cebar precisa de MQTT.</p>
      ) : null}
    </div>
  );
}
