'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import type { WeekHoverMetrics } from '@/lib/grow-cycle-timeline/simulation-engine';
import { HW_TEXT } from '@/lib/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGrowCycleChrome } from '@/lib/translations/grow-cycle';

interface GrowCycleWeekHoverTooltipProps {
  metrics: WeekHoverMetrics;
  pointer: { clientX: number; clientY: number };
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_W = 300;
const TOOLTIP_H = 340;

function formatEc(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value)} µS/cm`;
}

function formatPh(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

function formatDailyDrop(
  value: number | null,
  digits: number,
  unit: string,
  perDay: string
): string {
  if (value == null) return '—';
  const n = value.toFixed(digits);
  return unit ? `${n} ${unit}${perDay}` : `${n}${perDay}`;
}

function formatMl(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 ml';
  return `${value.toFixed(1)} ml`;
}

export function GrowCycleWeekHoverTooltip({
  metrics,
  pointer,
}: GrowCycleWeekHoverTooltipProps) {
  const { locale } = useLanguage();
  const chrome = useMemo(() => getGrowCycleChrome(locale), [locale]);
  const h = chrome.hover;
  const phaseLabels = chrome.phaseLabels;
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
      ? h.thisWeek
      : metrics.weekKind === 'past'
        ? h.pastWeek
        : h.futureWeek;

  return (
    <div
      className="fixed z-50 pointer-events-none w-[300px] rounded-xl border border-dark-border bg-dark-card/95 backdrop-blur-sm shadow-xl shadow-black/40 p-3"
      style={{ left: pos.left, top: pos.top }}
      role="tooltip"
    >
      <p className="text-xs font-semibold text-dark-text mb-2">
        {h.weekTitle.replace('{n}', String(metrics.weekIndex))}
        <span className="text-dark-textSecondary font-normal">
          {' '}
          · {phaseLabels[metrics.phase]}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ec}`}>EC</p>
          <div>
            <p className="text-dark-textSecondary">{h.target}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {metrics.ecSetpoint} µS/cm
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.initial}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {formatEc(metrics.ecFirst)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.final}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {formatEc(metrics.ecLast)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.avgDailyDrop}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {formatDailyDrop(metrics.ecAvgDailyDrop, 0, 'µS', h.perDay)}
            </p>
          </div>
          {!future && (
            <>
              <div>
                <p className="text-dark-textSecondary">{h.nutrientsMl}</p>
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
                <p className="text-dark-textSecondary">{h.adjustments}</p>
                <p className="text-dark-text tabular-nums">{metrics.ecAdjustments}</p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ph}`}>pH</p>
          <div>
            <p className="text-dark-textSecondary">{h.target}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {metrics.phSetpoint.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.initial}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {formatPh(metrics.phFirst)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.final}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {formatPh(metrics.phLast)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">{h.avgDailyDrop}</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {formatDailyDrop(metrics.phAvgDailyDrop, 2, '', h.perDay)}
            </p>
          </div>
          {!future && (
            <>
              <div>
                <p className="text-dark-textSecondary">{h.phMl}</p>
                <p className="text-dark-text tabular-nums">
                  {formatMl(metrics.phMlUp)} / {formatMl(metrics.phMlDown)}
                </p>
              </div>
              <div>
                <p className="text-dark-textSecondary">{h.adjustments}</p>
                <p className="text-dark-text tabular-nums">{metrics.phAdjustments}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[9px] text-dark-textSecondary mt-2 pt-2 border-t border-dark-border/50">
        {future
          ? h.futureNote
          : metrics.hasWeekData
            ? h.summaryWithData
                .replace('{weekLabel}', weekLabel)
                .replace('{L}', String(metrics.tankVolumeL))
            : h.summaryNoData
                .replace('{weekLabel}', weekLabel)
                .replace('{L}', String(metrics.tankVolumeL))}
      </p>
    </div>
  );
}
