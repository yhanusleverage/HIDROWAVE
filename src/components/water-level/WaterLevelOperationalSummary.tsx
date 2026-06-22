'use client';

import React from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricRow } from '@/components/ui/MetricRow';
import { HW_BADGE } from '@/lib/design-tokens';
import type { LevelSensorsState } from '@/hooks/useLevelSensors';
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
  className?: string;
};

export function WaterLevelOperationalSummary({
  levels,
  className = '',
}: WaterLevelOperationalSummaryProps) {
  const probes = [levels.level1, levels.level2, levels.level3, levels.level4];
  const wetCount = countWetProbes(probes);
  const knownCount = countKnownProbes(probes);
  const hasData = hasLevelTelemetry(probes, levels.waterLevel);
  const aggregateLabel = getAggregateLabel(levels.waterLevel, levels.isLoading);
  const aggregateAccent = getAggregateBadgeAccent(levels.waterLevel);
  const interlock = getInterlockLabel(levels.waterLevelOk);

  return (
    <div className={`flex flex-col ${className}`}>
      <SectionHeader
        accent="wait"
        title="Resumo operacional"
        subtitle="Interlock hidráulico compartilhado por Auto EC e Auto pH"
      />

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
            knownCount > 0 ? `${wetCount} / ${PROBE_COUNT}` : levels.isLoading ? '…' : '--'
          }
          variant={wetCount === PROBE_COUNT ? 'ok' : wetCount === 0 && knownCount > 0 ? 'alarm' : 'default'}
        />
        <MetricRow
          label="Interlock dosagem:"
          value={
            levels.waterLevelOk === null
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

      {!hasData && !levels.isLoading && (
        <p className="mt-3 text-xs leading-relaxed text-dark-textSecondary">
          Aguardando telemetria — execute ADD_LEVEL_SENSORS_COLUMNS.sql e flasheie o firmware com
          leitura level_1–level_4.
        </p>
      )}
    </div>
  );
}
