'use client';

import { useLayoutEffect, useState } from 'react';
import type { WeekHoverMetrics } from '@/lib/grow-cycle-timeline/simulation-engine';
import { PHASE_LABELS } from '@/lib/grow-cycle-timeline/types';
import { HW_TEXT } from '@/lib/design-tokens';
import { HwBadge } from '@/components/ui/HwBadge';

interface GrowCycleWeekHoverTooltipProps {
  metrics: WeekHoverMetrics;
  pointer: { clientX: number; clientY: number };
  deviceId?: string | null;
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_W = 300;
const TOOLTIP_H = 200;

function autoStatusLabel(status: WeekHoverMetrics['autoStatus']): string {
  if (status === 'on') return 'ON';
  if (status === 'paused_p1') return 'Pausado P1';
  return 'OFF';
}

function autoStatusAccent(
  status: WeekHoverMetrics['autoStatus']
): 'ec' | 'ph' | 'wait' | 'neutral' {
  if (status === 'on') return 'ec';
  if (status === 'paused_p1') return 'wait';
  return 'neutral';
}

function formatDosage(ml: number | null): string {
  if (ml == null) return '—';
  return `${ml.toFixed(1)} ml`;
}

function truncateDevice(id: string): string {
  const t = id.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

export function GrowCycleWeekHoverTooltip({
  metrics,
  pointer,
  deviceId,
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

  return (
    <div
      className="fixed z-50 pointer-events-none w-[300px] rounded-xl border border-dark-border bg-dark-card/95 backdrop-blur-sm shadow-xl shadow-black/40 p-3"
      style={{ left: pos.left, top: pos.top }}
      role="tooltip"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-dark-text">
          Semana S{metrics.weekIndex}
          <span className="text-dark-textSecondary font-normal">
            {' '}
            · {PHASE_LABELS[metrics.phase]}
          </span>
        </p>
        <HwBadge accent={autoStatusAccent(metrics.autoStatus)}>
          {autoStatusLabel(metrics.autoStatus)}
        </HwBadge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ec}`}>Auto EC</p>
          <div>
            <p className="text-dark-textSecondary">Alvo</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {metrics.ecSetpoint} µS/cm
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Atual</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {Math.round(metrics.ecActual)} µS/cm
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Erro</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {Math.round(metrics.ecError)} µS/cm
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Dosagem</p>
            <p className="text-dark-text tabular-nums">{formatDosage(metrics.lastDosageEcMl)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={`font-semibold ${HW_TEXT.ph}`}>Auto pH</p>
          <div>
            <p className="text-dark-textSecondary">Alvo</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {metrics.phSetpoint.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Atual</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {metrics.phActual.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Erro</p>
            <p className={`font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {metrics.phError.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary">Dosagem</p>
            <p className="text-dark-text tabular-nums">{formatDosage(metrics.lastDosagePhMl)}</p>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-dark-textSecondary mt-2 pt-2 border-t border-dark-border/50">
        {metrics.source === 'live' && deviceId?.trim()
          ? `Ao vivo · ${truncateDevice(deviceId)}`
          : 'Simulado'}
      </p>
    </div>
  );
}
