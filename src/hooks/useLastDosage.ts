/**
 * Última dosagem registrada — SUM(ml) do último sequence_id em nutrient_dosages.
 * Capa Status do Controle: solo total ml (sem nomes de nutrientes).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeNutrientDosageInserts } from '@/lib/realtime/nutrient-dosages';

const POLL_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 400;
const TABLE_MISSING = '42P01';

export interface LastDosageResult {
  totalMl: number | null;
  sequenceId: string | null;
  completedAt: string | null;
  isLoading: boolean;
  available: boolean;
}

async function fetchLastDosageSum(deviceId: string): Promise<{
  totalMl: number | null;
  sequenceId: string | null;
  completedAt: string | null;
  tableMissing: boolean;
}> {
  const { data: latestRows, error: latestError } = await supabase
    .from('nutrient_dosages')
    .select('sequence_id, created_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (latestError) {
    if (latestError.code === TABLE_MISSING) {
      return { totalMl: null, sequenceId: null, completedAt: null, tableMissing: true };
    }
    throw latestError;
  }

  if (!latestRows?.length) {
    return { totalMl: null, sequenceId: null, completedAt: null, tableMissing: false };
  }

  const sequenceId = latestRows[0].sequence_id as string;
  const { data: seqRows, error: seqError } = await supabase
    .from('nutrient_dosages')
    .select('dosage_ml, created_at')
    .eq('device_id', deviceId)
    .eq('sequence_id', sequenceId);

  if (seqError) {
    if (seqError.code === TABLE_MISSING) {
      return { totalMl: null, sequenceId: null, completedAt: null, tableMissing: true };
    }
    throw seqError;
  }

  const totalMl = (seqRows ?? []).reduce(
    (sum, row) => sum + (Number(row.dosage_ml) || 0),
    0
  );

  const completedAt =
    seqRows?.reduce<string | null>((max, row) => {
      const t = row.created_at as string;
      return !max || t > max ? t : max;
    }, null) ?? null;

  return {
    totalMl: totalMl > 0 ? Math.round(totalMl * 100) / 100 : null,
    sequenceId,
    completedAt,
    tableMissing: false,
  };
}

export function useLastDosage(deviceId: string, enabled = true): LastDosageResult {
  const [totalMl, setTotalMl] = useState<number | null>(null);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const pausedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || !deviceId?.trim() || pausedRef.current) return;

    try {
      setIsLoading(true);
      const result = await fetchLastDosageSum(deviceId.trim());

      if (result.tableMissing) {
        pausedRef.current = true;
        setAvailable(false);
        setTotalMl(null);
        return;
      }

      setTotalMl(result.totalMl);
      setSequenceId(result.sequenceId);
      setCompletedAt(result.completedAt);
    } catch {
      /* silencioso — tabela opcional */
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    pausedRef.current = false;
    setAvailable(true);
    setTotalMl(null);
    setSequenceId(null);
    setCompletedAt(null);
  }, [deviceId]);

  useEffect(() => {
    if (!enabled || !deviceId?.trim()) return;

    refresh();
    const pollId = setInterval(refresh, POLL_MS);

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeNutrientDosageInserts(deviceId.trim(), () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        refresh();
      }, REALTIME_DEBOUNCE_MS);
    });

    return () => {
      clearInterval(pollId);
      if (debounceId) clearTimeout(debounceId);
      unsubscribe();
    };
  }, [deviceId, enabled, refresh]);

  return { totalMl, sequenceId, completedAt, isLoading, available };
}
