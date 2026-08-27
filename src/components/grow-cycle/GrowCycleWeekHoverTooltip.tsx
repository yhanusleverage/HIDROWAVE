'use client';

import { useLayoutEffect, useState } from 'react';
import type { WeekHoverMetrics } from '@/lib/grow-cycle-timeline/simulation-engine';
import { PHASE_LABELS } from '@/lib/grow-cycle-timeline/types';
import { HW_TEXT } from '@/lib/design-tokens';

interface GrowCycleWeekHoverTooltipProps {
  metrics: WeekHoverMetrics;
  pointer: { clientX: number; clientY: number };
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_W = 300;
const TOOLTIP_H = 320;

function dropCaption(value: number | null, metric: string): string {
  if (value == null || value < 0) return `Queda ${metric}`;
  if (value > 0) return `Subida ${metric}`;
  return `Δ ${metric}`;
}

function formatDrop(value: number | null, digits: number, unit: string): string {
  if (value == null) return '—';
  if (value < 0) {
    const abs = Math.abs(value).toFixed(digits);
    return unit ? `queda ${abs} ${unit}` : `queda ${abs}`;
  }
  const sign = value > 0 ? '+' : '';
  return unit ? `${sign}${value.toFixed(digits)} ${unit}` : `${sign}${value.toFixed(digits)}`;
}

function formatMl(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 ml';
  return `${value.toFixed(1)} ml`;
}

export function GrowCycleWeekHoverTooltip({
  metrics,
  pointer,
}: GrowCycleWeekHoverTooltipProps) {
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const maxLeft = window.innerWidth - TOOLTIP_W - 8;
    const maxTop = window.innerHeight - TOOLTIP_H - 8;
    let left = pointer.clientX + TOOLTIP_OFFSET;
    let top = pointer.clientY + TOOLTIP_OFFSET;

    if (left > maxLeft) left = pointer.clientX - TOOLTIP_W - TOOLTIP_OFFSET;
    if (top > maxTop) top = pointer.clientY - TOOLTIP_H - TOOLTIP_OFFSET;

    setPos({
      left: Math.max(8, left),
      top: Math.max(8, top),
    });
  }, [pointer.clientX, pointer.clientY]);

  const future = metrics.weekKind === 'future';
  const weekLabel =
    metrics.weekKind === 'current'
      ? 'esta semana'
      : metrics.weekKind === 'past'
        ? 'nesta semana'
        : 'ainda não começou';

  return (
    <div
      className="fixed z-50 pointer-events-none w-[300px] rounded-xl border border-dark-border bg-dark-card/95 backdrop-blur-sm shadow-xl shadow-black/40 p-3"
      style={{ left: pos.left, top: pos.top }}
      role="tooltip"
    >
      <p className="text-xs font-semibold text-dark-text mb-2">
        Semana S{metrics.weekIndex}
        <span className="text-dark-textSecondary font-normal">
          {' '}
          · {PHASE_LABELS[metrics.phase]}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ec}`}>EC</p>
          <div>
            <p className="text-dark-textSecondary">Alvo</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {metrics.ecSetpoint} µS/cm
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">
              {dropCaption(metrics.ecDelta, 'EC')} {weekLabel}
            </p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {formatDrop(metrics.ecDelta, 0, 'µS')}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">EC médio</p>
            <p className="text-dark-text tabular-nums">
              {metrics.ecAvg != null ? `${Math.round(metrics.ecAvg)} µS/cm` : '—'}
            </p>
          </div>
          {!future && (
            <>
              <div>
                <p className="text-dark-textSecondary">ml nutrientes</p>
                <p className="text-dark-text tabular-nums">{formatMl(metrics.ecMlTotal)}</p>
              </div>
              {metrics.byNutrient.length > 0 && (
                <ul className="text-[10px] text-dark-textSecondary space-y-0.5">
                  {metrics.byNutrient.slice(0, 4).map((n) => (
                    <li key={n.name}>
                      {n.name}: {n.ml.toFixed(1)} ml
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <p className="text-dark-textSecondary">Ajustes</p>
                <p className="text-dark-text tabular-nums">{metrics.ecAdjustments}</p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ph}`}>pH</p>
          <div>
            <p className="text-dark-textSecondary">Alvo</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {metrics.phSetpoint.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">
              {dropCaption(metrics.phDelta, 'pH')} {weekLabel}
            </p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {formatDrop(metrics.phDelta, 2, '')}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">pH médio</p>
            <p className="text-dark-text tabular-nums">
              {metrics.phAvg != null ? metrics.phAvg.toFixed(2) : '—'}
            </p>
          </div>
          {!future && (
            <>
              <div>
                <p className="text-dark-textSecondary">ml pH+ / pH−</p>
                <p className="text-dark-text tabular-nums">
                  {formatMl(metrics.phMlUp)} / {formatMl(metrics.phMlDown)}
                </p>
              </div>
              <div>
                <p className="text-dark-textSecondary">Ajustes</p>
                <p className="text-dark-text tabular-nums">{metrics.phAdjustments}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[9px] text-dark-textSecondary mt-2 pt-2 border-t border-dark-border/50">
        {future
          ? 'Semana futura — alvo da receita. Queda e média quando a semana começar.'
          : metrics.hasWeekData
            ? `Resumo ${weekLabel} · tanque ${metrics.tankVolumeL} L`
            : `Sem dados ainda ${weekLabel} · tanque ${metrics.tankVolumeL} L`}
      </p>
    </div>
  );
}
