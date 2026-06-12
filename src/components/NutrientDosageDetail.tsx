'use client';

/**
 * Capa designer — detalhe por nutriente da última secuencia (fora do bloco Status do Controle).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Paleta fixa por índice — até 8 nutrientes por secuencia */
const SEGMENT_COLORS = [
  { bar: 'bg-aqua-500', legend: 'bg-aqua-500' },
  { bar: 'bg-primary-500', legend: 'bg-primary-500' },
  { bar: 'bg-emerald-500', legend: 'bg-emerald-500' },
  { bar: 'bg-violet-500', legend: 'bg-violet-500' },
  { bar: 'bg-amber-500', legend: 'bg-amber-500' },
  { bar: 'bg-rose-500', legend: 'bg-rose-500' },
  { bar: 'bg-cyan-500', legend: 'bg-cyan-500' },
  { bar: 'bg-orange-500', legend: 'bg-orange-500' },
] as const;

function formatPct(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatMl(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildCompositionAriaLabel(
  items: { name: string; pct: number; ml: number }[],
  totalMl: number
): string {
  const parts = items.map(
    (item) =>
      `${item.name} ${formatPct(item.pct)} por cento, ${formatMl(item.ml)} mililitros`
  );
  return `Composição da dosagem: ${parts.join('; ')}; total ${formatMl(totalMl)} mililitros`;
}

/** Agrupa filas duplicadas (mesmo nutriente + relé) — evita 50%+50% do mesmo item. */
function aggregateNutrientRows(rows: NutrientDosageRow[]): NutrientDosageRow[] {
  const map = new Map<string, NutrientDosageRow>();

  for (const row of rows) {
    const name = (row.nutrient_name || '').trim() || `Relé ${row.relay_number + 1}`;
    const key = `${name.toLowerCase()}|${row.relay_number}`;
    const ml = Number(row.dosage_ml) || 0;
    const sec = Number(row.dosage_time_seconds) || 0;
    const existing = map.get(key);

    if (existing) {
      existing.dosage_ml = Number(existing.dosage_ml) + ml;
      existing.dosage_time_seconds = Number(existing.dosage_time_seconds) + sec;
    } else {
      map.set(key, {
        ...row,
        nutrient_name: name,
        dosage_ml: ml,
        dosage_time_seconds: sec,
      });
    }
  }

  return Array.from(map.values());
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

  const aggregatedRows = useMemo(() => aggregateNutrientRows(rows), [rows]);
  const hasDuplicateEntries = aggregatedRows.length < rows.length;

  const composition = useMemo(() => {
    const totalMl = aggregatedRows.reduce((s, r) => s + (Number(r.dosage_ml) || 0), 0);
    return aggregatedRows.map((row, idx) => {
      const ml = Number(row.dosage_ml) || 0;
      const pct = totalMl > 0 ? (ml / totalMl) * 100 : 0;
      const name = row.nutrient_name || `Relé ${row.relay_number + 1}`;
      const colors = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
      return { row, ml, pct, name, colors, idx };
    });
  }, [aggregatedRows]);

  if (!sequenceId || rows.length === 0) {
    return null;
  }

  const totalMl = composition.reduce((s, c) => s + c.ml, 0);
  const singleNutrient = composition.length === 1;
  const ariaLabel = buildCompositionAriaLabel(
    composition.map((c) => ({ name: c.name, pct: c.pct, ml: c.ml })),
    totalMl
  );

  const nutrientCount = composition.length;

  return (
    <div className="mt-3 border border-dark-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-surface hover:bg-dark-surface/80 text-left"
      >
        <span className="text-sm font-medium text-dark-text">
          Detalhe da última dosagem ({nutrientCount} nutriente{nutrientCount !== 1 ? 's' : ''})
        </span>
        <span className="text-sm text-aqua-400 font-mono tabular-nums">
          {formatMl(totalMl)} ml total
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-dark-bg/50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-dark-textSecondary">
                Composição da dosagem
              </span>
              {!singleNutrient && (
                <p className="text-[11px] text-dark-textSecondary mt-0.5 normal-case tracking-normal">
                  participação de cada nutriente no volume total
                </p>
              )}
            </div>
            <span className="text-xs font-mono tabular-nums text-aqua-400 shrink-0">
              {formatMl(totalMl)} ml total
            </span>
          </div>

          {hasDuplicateEntries && (
            <p className="text-[11px] text-amber-400/90 border border-amber-500/30 rounded-md px-2 py-1.5 bg-amber-500/10">
              Registos duplicados do mesmo nutriente/relé foram unificados. Verifique a tabela
              nutricional (uma linha por nutriente) e flash do firmware recente.
            </p>
          )}

          {/* Barra empilhada 100% */}
          <div
            role="img"
            aria-label={ariaLabel}
            className="flex h-3 w-full rounded-md overflow-hidden bg-dark-border/60"
          >
            {composition.map(({ pct, name, ml, colors, idx }) => (
              <div
                key={`seg-${idx}`}
                className={`${colors.bar} h-full transition-all min-w-0`}
                style={{ width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%` }}
                title={`${name} — ${formatPct(pct)}% (${formatMl(ml)} ml)`}
              />
            ))}
          </div>

          {/* Legenda — omitida se nutriente único */}
          {!singleNutrient && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {composition.map(({ name, pct, colors, idx }) => (
                <div
                  key={`leg-${idx}`}
                  className="flex items-center gap-1.5 text-xs text-dark-textSecondary"
                >
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${colors.legend}`}
                    aria-hidden
                  />
                  <span className="text-dark-text">{name}</span>
                  <span className="font-mono tabular-nums">{formatPct(pct)}%</span>
                </div>
              ))}
            </div>
          )}

          {singleNutrient && (
            <p className="text-xs text-dark-textSecondary font-mono tabular-nums">100%</p>
          )}

          <ul className="divide-y divide-dark-border border-t border-dark-border pt-1">
            {composition.map(({ row, ml, pct, name, colors, idx }) => (
              <li
                key={`${row.nutrient_name}-${row.relay_number}-${idx}`}
                className="py-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-dark-text shrink-0">
                    {name}
                    <span className="text-dark-textSecondary ml-2">
                      R{row.relay_number + 1}
                    </span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-dark-surface border border-dark-border text-aqua-400">
                      {formatPct(pct)}%
                    </span>
                    <span className="font-mono tabular-nums text-dark-text">
                      {formatMl(ml)} ml
                    </span>
                    <span className="text-dark-textSecondary text-xs font-mono tabular-nums">
                      {Number(row.dosage_time_seconds).toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      s
                    </span>
                  </div>
                </div>
                <div
                  className="h-1.5 w-full rounded-full bg-dark-border/60 overflow-hidden"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full ${colors.bar}`}
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
