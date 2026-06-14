'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribePhDosageInserts, type PhDosageRow } from '@/lib/realtime/ph-dosages';
import { formatSensorValue } from '@/lib/format-sensor-value';

interface PhDosageDetailProps {
  deviceId: string;
  enabled?: boolean;
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

export function PhDosageDetail({ deviceId, enabled = true }: PhDosageDetailProps) {
  const [lastDosage, setLastDosage] = useState<PhDosageRow | null>(null);

  const fetchLatest = useCallback(async () => {
    if (!deviceId || !enabled) return;
    const { data, error } = await supabase
      .from('ph_dosages')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setLastDosage(data as PhDosageRow);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    if (!deviceId || !enabled) return;
    return subscribePhDosageInserts(deviceId, (row) => {
      setLastDosage(row);
    });
  }, [deviceId, enabled]);

  if (!enabled || !deviceId) return null;

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg p-4 mt-4">
      <h4 className="text-base font-semibold text-dark-text mb-3">💧 Última dosagem pH</h4>
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
            <span className="text-dark-text font-medium tabular-nums">{formatMl(Number(lastDosage.dosage_ml) || 0)} ml</span>
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
              {lastDosage.ph_before != null ? formatSensorValue(Number(lastDosage.ph_before), 2) : '--'}
            </span>
          </div>
          <div className="flex justify-between sm:block">
            <span className="text-dark-textSecondary">Setpoint:</span>{' '}
            <span className="text-dark-text font-medium tabular-nums">
              {lastDosage.ph_setpoint != null ? formatSensorValue(Number(lastDosage.ph_setpoint), 2) : '--'}
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
