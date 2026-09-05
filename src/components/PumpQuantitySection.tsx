'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannelStatus } from '@/lib/realtime/channel';
import {
  subscribePumpQuantity,
  type PumpQuantityRow,
} from '@/lib/realtime/pump-quantity';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';

export type { PumpQuantityRow };

type Props = {
  deviceId: string;
  relayOptions: Array<{ number: number; name: string }>;
};

function formatMl(v: number): string {
  if (!Number.isFinite(v)) return '0';
  if (v >= 1000) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function LiveBadge({ status }: { status: RealtimeChannelStatus | 'connecting' }) {
  const { t } = useLanguage();
  const q = t.calibragem.qty;
  const live = status === 'SUBSCRIBED';
  const label =
    status === 'SUBSCRIBED'
      ? q.live
      : status === 'connecting'
        ? q.connecting
        : status === 'CHANNEL_ERROR'
          ? q.realtimeOff
          : q.offline;

  return (
    <span
      title={live ? q.liveHintOn : q.liveHintOff}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${
        live
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : status === 'connecting'
            ? 'border-dark-border bg-dark-card text-dark-textSecondary'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          live ? 'bg-emerald-400 animate-pulse' : 'bg-current opacity-70'
        }`}
      />
      {label}
    </span>
  );
}

export function PumpQuantitySection({ deviceId, relayOptions }: Props) {
  const { t, locale } = useLanguage();
  const q = t.calibragem.qty;
  const [rows, setRows] = useState<PumpQuantityRow[]>([]);
  const [resetting, setResetting] = useState<number | null>(null);
  const [rtStatus, setRtStatus] = useState<RealtimeChannelStatus | 'connecting'>(
    'connecting'
  );

  const load = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { data, error } = await supabase
        .from('pump_quantity')
        .select(
          'device_id,relay_index,role,total_ml,last_increment_at,last_reset_at,updated_at'
        )
        .eq('device_id', deviceId)
        .order('relay_index', { ascending: true });
      if (error) throw error;
      setRows((data as PumpQuantityRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error(q.toastLoadError);
    }
  }, [deviceId, q.toastLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!deviceId) return;
    setRtStatus('connecting');
    return subscribePumpQuantity(
      deviceId,
      (row) => {
        setRows((prev) => {
          const idx = prev.findIndex((r) => r.relay_index === row.relay_index);
          if (idx < 0) {
            return [...prev, row].sort((a, b) => a.relay_index - b.relay_index);
          }
          const next = [...prev];
          next[idx] = { ...next[idx], ...row };
          return next;
        });
      },
      (status) => setRtStatus(status)
    );
  }, [deviceId]);

  const totalFor = (relay: number): number => {
    const r = rows.find((x) => x.relay_index === relay);
    return r ? Number(r.total_ml) || 0 : 0;
  };

  const lastInc = (relay: number): string | null => {
    const r = rows.find((x) => x.relay_index === relay);
    return r?.last_increment_at || null;
  };

  const handleReset = async (relay: number) => {
    if (!deviceId) return;
    setResetting(relay);
    try {
      const { error } = await supabase.rpc('reset_pump_quantity', {
        p_device_id: deviceId,
        p_relay_index: relay,
        p_reset_by: 'web',
      });
      if (error) throw error;
      toast.success(q.toastResetOk.replace('{n}', String(relay)));
      // Realtime atualiza; load() cobre se o evento chegar atrasado
      void load();
    } catch (e) {
      console.error(e);
      toast.error(q.toastResetFail);
    } finally {
      setResetting(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 rounded-xl p-5">
        <p className="text-sm text-dark-textSecondary">{q.intro}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-dark-text">{q.title}</h2>
        <LiveBadge status={rtStatus} />
      </div>

      <ul className="space-y-2">
        {relayOptions.map((opt) => {
          const ml = totalFor(opt.number);
          const inc = lastInc(opt.number);
          return (
            <li
              key={opt.number}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-dark-card border border-dark-border rounded-xl px-4 py-3"
            >
              <div>
                <div className="font-medium text-dark-text">
                  {opt.number}: {opt.name}
                </div>
                <div className="text-2xl font-semibold text-emerald-400 tabular-nums mt-0.5">
                  {formatMl(ml)}{' '}
                  <span className="text-sm font-normal text-dark-textSecondary">ml</span>
                </div>
                {inc ? (
                  <div className="text-xs text-dark-textSecondary mt-1">
                    {q.lastIncrement.replace(
                      '{when}',
                      new Date(inc).toLocaleString(toBcp47(locale))
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-dark-textSecondary mt-1">{q.noDoses}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleReset(opt.number)}
                disabled={resetting === opt.number || ml <= 0}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetting === opt.number ? q.resetting : q.reset}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
