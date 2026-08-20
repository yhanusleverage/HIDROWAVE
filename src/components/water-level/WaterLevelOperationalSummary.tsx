'use client';

import React, { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricRow } from '@/components/ui/MetricRow';
import { HW_BADGE } from '@/lib/design-tokens';
import type { LevelInterlockMode, LevelSensorsState } from '@/hooks/useLevelSensors';
import {
  countKnownProbes,
  countWetProbes,
  formatTelemetryTime,
  getAggregateBadgeAccent,
  getAggregateLabel,
  getInterlockLabel,
  hasLevelTelemetry,
  PROBE_COUNT,
} from '@/lib/water-level-display';

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap tabular-nums';

export type WaterLevelOperationalSummaryProps = {
  levels: LevelSensorsState;
  deviceId: string;
  className?: string;
};

export function WaterLevelOperationalSummary({
  levels,
  deviceId,
  className = '',
}: WaterLevelOperationalSummaryProps) {
  const simulated = levels.levelsSimulated;
  const probes = [levels.level1, levels.level2, levels.level3, levels.level4];
  const wetCount = countWetProbes(probes);
  const knownCount = countKnownProbes(probes);
  const hasData = hasLevelTelemetry(probes, levels.waterLevel, simulated);
  const aggregateLabel = getAggregateLabel(levels.waterLevel, levels.isLoading, simulated);
  const aggregateAccent = getAggregateBadgeAccent(levels.waterLevel, simulated);
  const interlock = getInterlockLabel(levels.waterLevelOk, simulated);
  const mode: LevelInterlockMode = levels.levelInterlockMode ?? 'normal';

  const [modeOpen, setModeOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  async function setInterlockMode(next: 'normal' | 'carrera') {
    if (pending || next === mode) return;
    setPending(true);
    setModeError(null);
    try {
      const res = await fetch('/api/level-interlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, mode: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setModeError(
          typeof data?.error === 'string' ? data.error : `Falha HTTP ${res.status}`
        );
      }
    } catch (e) {
      setModeError(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <SectionHeader
        accent="wait"
        title="Resumo operacional"
        subtitle="Interlock hidráulico compartilhado por Auto EC e Auto pH"
      />

      {simulated && (
        <p className="mb-3 text-xs leading-relaxed text-amber-400/90 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          Níveis simulados no firmware (<code className="text-[10px]">HIDRO_SIMULATE_WATER_LEVELS=1</code>).
          Valores abaixo não refletem sondas L1–L4 instaladas.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`${badgeBase} ${HW_BADGE[aggregateAccent]}`}>
          <span className="text-[10px] uppercase tracking-wide opacity-80 mr-1">Nível</span>
          {aggregateLabel}
        </span>
        <span className={`${badgeBase} ${HW_BADGE[interlock.accent]}`}>
          <span className="text-[10px] uppercase tracking-wide opacity-80 mr-1">Auto EC/pH</span>
          {interlock.text}
        </span>
      </div>

      <div className="space-y-2 rounded-lg border border-dark-border/50 bg-dark-bg/30 px-3 py-3">
        <MetricRow
          label="Níveis alcançados:"
          value={
            simulated
              ? '--'
              : knownCount > 0
                ? `${wetCount} / ${PROBE_COUNT}`
                : levels.isLoading
                  ? '…'
                  : '--'
          }
          variant={
            simulated
              ? 'default'
              : wetCount === PROBE_COUNT
                ? 'ok'
                : wetCount === 0 && knownCount > 0
                  ? 'alarm'
                  : 'default'
          }
        />
        <MetricRow
          label="Interlock dosagem:"
          value={
            simulated
              ? '-- (simulado)'
              : levels.waterLevelOk === null
                ? '--'
                : levels.waterLevelOk
                  ? 'Volume adequado para dosagem'
                  : 'Dosagem bloqueada — verificar nível'
          }
          variant={interlock.variant}
        />
        <MetricRow
          label="Última telemetria:"
          value={
            levels.isLoading
              ? '…'
              : formatTelemetryTime(levels.lastTelemetryAt)
          }
        />
      </div>

      <div className="mt-3 rounded-lg border border-dark-border/50 bg-dark-bg/20">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-dark-text"
          onClick={() => setModeOpen((o) => !o)}
          aria-expanded={modeOpen}
        >
          <span className="font-medium">Modo Auto EC/pH</span>
          <span className="text-xs text-dark-textSecondary tabular-nums">
            {mode === 'carrera' ? 'Carrera' : 'Normal'}
            <span className="ml-2 opacity-60">{modeOpen ? '▾' : '▸'}</span>
          </span>
        </button>
        {modeOpen && (
          <div className="border-t border-dark-border/40 px-3 pb-3 pt-2 space-y-2">
            <p className="text-[11px] leading-relaxed text-dark-textSecondary">
              Define quando a dosagem automática fica liberada.
            </p>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-dark-bg/40">
              <input
                type="radio"
                name="level-interlock"
                className="mt-1"
                checked={mode === 'normal'}
                disabled={pending || simulated}
                onChange={() => setInterlockMode('normal')}
              />
              <span className="text-xs leading-snug">
                <span className="font-semibold text-dark-text">Normal</span>
                <span className="block text-dark-textSecondary">
                  Libera com qualquer nível ≠ 0/4.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-dark-bg/40">
              <input
                type="radio"
                name="level-interlock"
                className="mt-1"
                checked={mode === 'carrera'}
                disabled={pending || simulated}
                onChange={() => setInterlockMode('carrera')}
              />
              <span className="text-xs leading-snug">
                <span className="font-semibold text-dark-text">Carrera</span>
                <span className="block text-dark-textSecondary">
                  Só libera no topo (4/4).
                </span>
              </span>
            </label>
            {pending && (
              <p className="text-[11px] text-dark-textSecondary">Aplicando…</p>
            )}
            {modeError && (
              <p className="text-[11px] text-red-400/90">{modeError}</p>
            )}
          </div>
        )}
      </div>

      {!hasData && !levels.isLoading && !simulated && (
        <p className="mt-3 text-xs leading-relaxed text-dark-textSecondary">
          Aguardando telemetria — execute ADD_LEVEL_SENSORS_COLUMNS.sql e flasheie o firmware com
          leitura level_1–level_4.
        </p>
      )}
    </div>
  );
}
