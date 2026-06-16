'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribePhDosageInserts, type PhDosageRow } from '@/lib/realtime/ph-dosages';
import { formatSensorValue } from '@/lib/format-sensor-value';

interface PhDosageDetailProps {
  deviceId: string;
  enabled?: boolean;
  /** footer = barra colapsável dentro de Status do Controle (igual EC) */
  variant?: 'card' | 'footer';
  onLastMlChange?: (ml: number | null) => void;
}

function formatMl(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function directionLabel(direction: string | null): string {
  if (direction === 'up') return 'pH+ (base)';
  if (direction === 'down') return 'pH− (ácido)';
  return '--';
}

export function PhDosageDetail({
  deviceId,
  enabled = true,
  variant = 'card',
  onLastMlChange,
}: PhDosageDetailProps) {
  const [lastDosage, setLastDosage] = useState<PhDosageRow | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchLatest = useCallback(async () => {
    if (!deviceId || !enabled) {
      setLastDosage(null);
      onLastMlChange?.(null);
      return;
    }
    const { data, error } = await supabase
      .from('ph_dosages')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const row = data as PhDosageRow;
      setLastDosage(row);
      onLastMlChange?.(Number(row.dosage_ml) || 0);
    } else {
      setLastDosage(null);
      onLastMlChange?.(null);
    }
  }, [deviceId, enabled, onLastMlChange]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!deviceId || !enabled) return;
    return subscribePhDosageInserts(deviceId, (row) => {
      setLastDosage(row);
      onLastMlChange?.(Number(row.dosage_ml) || 0);
    });
  }, [deviceId, enabled, onLastMlChange]);

  if (!enabled || !deviceId) return null;

  if (variant === 'footer') {
    if (!lastDosage) {
      return (
        <p className="mt-3 text-xs text-dark-textSecondary border border-dark-border rounded-lg px-4 py-2.5 bg-dark-surface/50">
          Nenhuma dosagem registrada ainda.
        </p>
      );
    }
    const ml = Number(lastDosage.dosage_ml) || 0;
    const dir = directionLabel(lastDosage.direction);

    return (
      <div className="mt-3 border border-dark-border border-t-2 border-t-violet-500 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-surface hover:bg-dark-surface/80 text-left"
        >
          <span className="text-sm font-medium text-dark-text">
            Detalhe da última dosagem registrada ({dir})
          </span>
          <span className="text-sm text-violet-400 font-mono tabular-nums">
            {formatMl(ml)} ml
          </span>
        </button>
        <p className="px-4 py-1 text-xs text-dark-textSecondary bg-dark-surface/30 border-t border-dark-border">
          {new Date(lastDosage.created_at).toLocaleString('pt-BR')}
        </p>

        {expanded && (
          <div className="px-4 py-3 bg-dark-bg/50 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-textSecondary">Direção</span>
              <span className="text-dark-text font-medium">{dir}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-textSecondary">Duração</span>
              <span className="text-dark-text font-medium tabular-nums">
                {formatSensorValue(Number(lastDosage.dosage_time_seconds) || 0, 1)} s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-textSecondary">pH antes</span>
              <span className="text-dark-text font-medium tabular-nums">
                {lastDosage.ph_before != null
                  ? formatSensorValue(Number(lastDosage.ph_before), 2)
                  : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-textSecondary">Setpoint</span>
              <span className="text-dark-text font-medium tabular-nums">
                {lastDosage.ph_setpoint != null
                  ? formatSensorValue(Number(lastDosage.ph_setpoint), 2)
                  : '--'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-dark-textSecondary pt-1 border-t border-dark-border">
              <span>Registado</span>
              <span>{new Date(lastDosage.created_at).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-4 mt-4">
      <h4 className="text-base font-semibold text-dark-text mb-3">💧 Última dosagem registrada</h4>
      {!lastDosage ? (
        <p className="text-sm text-dark-textSecondary">Nenhuma dosagem registrada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Direção:</span>{' '}
            <span className="text-dark-text font-medium">{directionLabel(lastDosage.direction)}</span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Volume:</span>{' '}
            <span className="text-dark-text font-medium tabular-nums">
              {formatMl(Number(lastDosage.dosage_ml) || 0)} ml
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Duração:</span>{' '}
            <span className="text-dark-text font-medium tabular-nums">
              {formatSensorValue(Number(lastDosage.dosage_time_seconds) || 0, 1)} s
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">pH antes:</span>{' '}
            <span className="text-dark-text font-medium tabular-nums">
              {lastDosage.ph_before != null
                ? formatSensorValue(Number(lastDosage.ph_before), 2)
                : '--'}
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Setpoint:</span>{' '}
            <span className="text-dark-text font-medium tabular-nums">
              {lastDosage.ph_setpoint != null
                ? formatSensorValue(Number(lastDosage.ph_setpoint), 2)
                : '--'}
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Registado:</span>{' '}
            <span className="text-dark-textSecondary text-xs">
              {new Date(lastDosage.created_at).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
