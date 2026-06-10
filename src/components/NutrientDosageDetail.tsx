'use client';

/**
 * Capa designer — detalhe por nutriente da última secuencia (fora do bloco Status do Controle).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeNutrientDosageInserts } from '@/lib/realtime/nutrient-dosages';

interface NutrientDosageRow {
  nutrient_name: string;
  relay_number: number;
  dosage_ml: number;
  dosage_time_seconds: number;
  created_at: string;
}

interface NutrientDosageDetailProps {
  deviceId: string;
  sequenceId: string | null;
  enabled?: boolean;
}

export function NutrientDosageDetail({
  deviceId,
  sequenceId,
  enabled = true,
}: NutrientDosageDetailProps) {
  const [rows, setRows] = useState<NutrientDosageRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const sequenceIdRef = useRef(sequenceId);
  sequenceIdRef.current = sequenceId;

  const load = useCallback(async () => {
    if (!enabled || !deviceId?.trim() || !sequenceId) {
      setRows([]);
      return;
    }

    const { data, error } = await supabase
      .from('nutrient_dosages')
      .select('nutrient_name, relay_number, dosage_ml, dosage_time_seconds, created_at')
      .eq('device_id', deviceId.trim())
      .eq('sequence_id', sequenceId)
      .order('created_at', { ascending: true });

    if (error) {
      setRows([]);
      return;
    }

    setRows((data as NutrientDosageRow[]) ?? []);
  }, [deviceId, sequenceId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;

    return subscribeNutrientDosageInserts(deviceId.trim(), (row) => {
      if (row.sequence_id === sequenceIdRef.current) {
        load();
      }
    });
  }, [deviceId, enabled, load]);

  if (!sequenceId || rows.length === 0) {
    return null;
  }

  const totalMl = rows.reduce((s, r) => s + (Number(r.dosage_ml) || 0), 0);

  return (
    <div className="mt-3 border border-dark-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-surface hover:bg-dark-surface/80 text-left"
      >
        <span className="text-sm font-medium text-dark-text">
          Detalhe da última dosagem ({rows.length} nutriente{rows.length !== 1 ? 's' : ''})
        </span>
        <span className="text-sm text-aqua-400 font-mono tabular-nums">
          {totalMl.toFixed(2)} ml total
        </span>
      </button>

      {expanded && (
        <ul className="divide-y divide-dark-border px-4 py-2 bg-dark-bg/50">
          {rows.map((row, idx) => (
            <li
              key={`${row.nutrient_name}-${row.relay_number}-${idx}`}
              className="flex justify-between py-2 text-sm"
            >
              <span className="text-dark-text">
                {row.nutrient_name || `Relé ${row.relay_number + 1}`}
                <span className="text-dark-textSecondary ml-2">
                  R{row.relay_number + 1}
                </span>
              </span>
              <span className="font-mono tabular-nums text-dark-text">
                {Number(row.dosage_ml).toFixed(2)} ml
                <span className="text-dark-textSecondary ml-2 text-xs">
                  {Number(row.dosage_time_seconds).toFixed(1)}s
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
