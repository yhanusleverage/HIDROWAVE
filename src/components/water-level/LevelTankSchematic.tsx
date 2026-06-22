'use client';

import React from 'react';
import { HW_TEXT } from '@/lib/design-tokens';
import {
  PROBE_META_DISPLAY,
  deriveFillHeightPct,
  getProbeCell,
  getProbeValue,
  countWetProbes,
} from '@/lib/water-level-display';

export type LevelTankSchematicProps = {
  probes: (boolean | null)[];
  className?: string;
};

export function LevelTankSchematic({ probes, className = '' }: LevelTankSchematicProps) {
  const wetCount = countWetProbes(probes);
  const fillPct = deriveFillHeightPct(wetCount);

  return (
    <div className={`flex flex-col ${className}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-dark-textSecondary">
        Esquema do reservatório
      </p>
      <div className="flex gap-4 flex-1 min-h-[220px]">
        {/* Silueta del tanque — L4 topo arriba, L1 base abajo */}
        <div className="relative w-16 shrink-0 flex flex-col min-h-[220px]">
          <p className="mb-1 text-center text-[9px] uppercase tracking-wide text-dark-textSecondary/70">
            topo
          </p>
          <div className="relative flex-1 flex flex-col">
            <div className="absolute inset-x-0 top-0 h-3 rounded-t-md border border-b-0 border-dark-border bg-dark-surface/80 z-10" />
            <div className="relative flex-1 mx-1 mt-3 mb-3 rounded-b-md border border-dark-border bg-dark-bg/60 overflow-hidden">
              <div
                className="absolute inset-x-0 bottom-0 bg-cyan-500/20 border-t border-cyan-500/30 transition-all duration-500 ease-out"
                style={{ height: `${fillPct}%` }}
                aria-hidden
              />
              {PROBE_META_DISPLAY.map((meta, displayIndex) => {
                const topPct = 12 + displayIndex * 22;
                return (
                  <div
                    key={meta.index}
                    className="absolute left-0 right-0 border-t border-dashed border-dark-border/50"
                    style={{ top: `${topPct}%` }}
                    aria-hidden
                  />
                );
              })}
            </div>
          </div>
          <p className="text-center text-[9px] uppercase tracking-wide text-dark-textSecondary/70">
            base
          </p>
        </div>

        {/* Lista L4 (topo) → L1 (base) */}
        <div className="flex flex-col justify-between flex-1 py-1">
          {PROBE_META_DISPLAY.map((meta) => {
            const cell = getProbeCell(getProbeValue(probes, meta.index));
            return (
              <div
                key={meta.index}
                className="flex items-center gap-3 rounded-md border border-dark-border/40 bg-dark-surface/30 px-3 py-2"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${cell.ledClass}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-dark-textSecondary">
                    {meta.shortLabel}
                    {meta.positionHint ? (
                      <span className="ml-1 font-normal normal-case text-dark-textSecondary/80">
                        ({meta.positionHint})
                      </span>
                    ) : null}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums shrink-0 ${
                    cell.variant === 'ok'
                      ? HW_TEXT.brand
                      : cell.variant === 'danger'
                        ? HW_TEXT.danger
                        : 'text-dark-textSecondary'
                  }`}
                >
                  {cell.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-dark-textSecondary tabular-nums">
        Níveis alcançados: {wetCount}/{PROBE_META_DISPLAY.length}
      </p>
    </div>
  );
}
