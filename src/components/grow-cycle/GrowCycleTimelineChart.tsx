'use client';

import { useCallback, useState } from 'react';
import type { GrowCyclePlan, GrowWeekProfile } from '@/lib/grow-cycle-timeline/types';
import {
  PHASE_COLORS,
  PHASE_LABELS,
} from '@/lib/grow-cycle-timeline/types';
import {
  getTankEventsForWeek,
  getSchedulesForWeek,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import { GrowCycleWeekHoverTooltip } from '@/components/grow-cycle/GrowCycleWeekHoverTooltip';
import { useGrowCycleWeekHoverMetrics } from '@/hooks/useGrowCycleWeekHoverMetrics';

interface GrowCycleTimelineChartProps {
  plan: GrowCyclePlan;
  selectedWeek: number;
  playheadWeek: number;
  onSelectWeek: (week: number) => void;
  deviceId?: string | null;
}

const MARGIN = { top: 48, right: 16, bottom: 36, left: 52 };
const EC_CHART_H = 200;
const PH_CHART_H = 120;
const GAP_BETWEEN_CHARTS = 28;
const WEEK_SLOT_W = 56;
const BAR_W = 16;
const EC_MAX = 2000;
const PH_MIN = 5.0;
const PH_MAX = 6.5;

const PHASE_FILL: Record<GrowWeekProfile['phase'], string> = {
  establishment: 'rgba(16,185,129,0.18)',
  vegetative: 'rgba(34,197,94,0.14)',
  flip: 'rgba(245,158,11,0.22)',
  flower: 'rgba(139,92,246,0.16)',
  flush: 'rgba(6,182,212,0.18)',
};

function ecToY(ec: number, innerH: number): number {
  const ratio = Math.min(1, Math.max(0, ec / EC_MAX));
  return innerH - ratio * innerH;
}

function phToY(ph: number, innerH: number): number {
  const ratio = Math.min(1, Math.max(0, (ph - PH_MIN) / (PH_MAX - PH_MIN)));
  return innerH - ratio * innerH;
}

function tankEventLabel(kind: string): string {
  if (kind === 'initial_fill') return 'FILL';
  if (kind === 'drain_full') return 'DRAIN';
  return 'CO';
}

function tankEventColor(kind: string): string {
  if (kind === 'drain_full') return '#f87171';
  if (kind === 'initial_fill') return '#22d3ee';
  return '#fbbf24';
}

export function GrowCycleTimelineChart({
  plan,
  selectedWeek,
  playheadWeek,
  onSelectWeek,
  deviceId,
}: GrowCycleTimelineChartProps) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ clientX: 0, clientY: 0 });

  const hoverMetrics = useGrowCycleWeekHoverMetrics(plan, hoveredWeek, deviceId);

  const handleWeekPointerMove = useCallback(
    (weekIndex: number, event: React.MouseEvent<SVGRectElement>) => {
      setHoveredWeek(weekIndex);
      setPointer({ clientX: event.clientX, clientY: event.clientY });
    },
    []
  );

  const handleWeekPointerLeave = useCallback(() => {
    setHoveredWeek(null);
  }, []);

  const weeks = plan.weeks.filter((w) => w.weekIndex <= plan.totalWeeks);
  const chartW = MARGIN.left + weeks.length * WEEK_SLOT_W + MARGIN.right;
  const ecInnerH = EC_CHART_H;
  const phInnerH = PH_CHART_H;
  const ecTop = MARGIN.top;
  const phTop = ecTop + ecInnerH + GAP_BETWEEN_CHARTS;
  const totalH = phTop + phInnerH + MARGIN.bottom + 72;

  const ecTicks = [0, 500, 1000, 1500, 2000];
  const phTicks = [5.0, 5.5, 6.0, 6.5];

  const weekCenterX = (i: number) =>
    MARGIN.left + i * WEEK_SLOT_W + WEEK_SLOT_W / 2;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-lg shadow-black/20">
      {/* Phase ribbon */}
      <div className="px-4 pt-4 pb-2 border-b border-dark-border/60">
        <p className="text-[10px] uppercase tracking-wider text-dark-textSecondary mb-2 font-semibold">
          Fases do ciclo
        </p>
        <div className="flex h-7 rounded-lg overflow-hidden border border-dark-border">
          {weeks.map((w) => (
            <button
              key={`phase-${w.weekIndex}`}
              type="button"
              onClick={() => onSelectWeek(w.weekIndex)}
              title={PHASE_LABELS[w.phase]}
              className={`flex-1 min-w-[36px] text-[9px] font-medium border-r border-dark-border/50 last:border-r-0 transition-opacity hover:opacity-90 ${PHASE_COLORS[w.phase]} ${
                w.weekIndex === selectedWeek ? 'ring-2 ring-inset ring-aqua-400/60' : ''
              }`}
            >
              <span className="truncate px-0.5 block text-center leading-7">
                {PHASE_LABELS[w.phase].slice(0, 3)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={Math.max(chartW, 640)}
          height={totalH}
          className="select-none"
          role="img"
          aria-label="Timeline EC e pH por semana de cultivo"
        >
          <defs>
            <linearGradient id="ecBarGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="phBarGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#34d399" floodOpacity="0.35" />
            </filter>
            <filter id="phGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#a78bfa" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* ── EC chart ── */}
          <text
            x={MARGIN.left - 8}
            y={ecTop - 12}
            textAnchor="end"
            className="fill-emerald-400 text-[11px] font-semibold"
          >
            EC alvo (µS/cm)
          </text>

          {/* Phase background bands (EC area) */}
          {weeks.map((w, i) => (
            <rect
              key={`ec-bg-${w.weekIndex}`}
              x={MARGIN.left + i * WEEK_SLOT_W}
              y={ecTop}
              width={WEEK_SLOT_W}
              height={ecInnerH}
              fill={PHASE_FILL[w.phase]}
            />
          ))}

          {/* EC grid + Y labels */}
          {ecTicks.map((tick) => {
            const y = ecTop + ecToY(tick, ecInnerH);
            return (
              <g key={`ec-tick-${tick}`}>
                <line
                  x1={MARGIN.left}
                  y1={y}
                  x2={chartW - MARGIN.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-dark-textSecondary text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* EC bars */}
          {weeks.map((w, i) => {
            const cx = weekCenterX(i);
            const barX = cx - BAR_W / 2;
            const yTop = ecTop + ecToY(w.ecSetpointUsCm, ecInnerH);
            const barH = ecTop + ecInnerH - yTop;
            const isSelected = w.weekIndex === selectedWeek;
            const isPlayhead = w.weekIndex === playheadWeek;
            const isHovered = w.weekIndex === hoveredWeek;

            return (
              <g key={`ec-bar-${w.weekIndex}`}>
                {/* Hit area */}
                <rect
                  x={MARGIN.left + i * WEEK_SLOT_W}
                  y={ecTop}
                  width={WEEK_SLOT_W}
                  height={ecInnerH + GAP_BETWEEN_CHARTS + phInnerH}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onSelectWeek(w.weekIndex)}
                  onMouseEnter={(e) => handleWeekPointerMove(w.weekIndex, e)}
                  onMouseMove={(e) => handleWeekPointerMove(w.weekIndex, e)}
                  onMouseLeave={handleWeekPointerLeave}
                />
                {isHovered && !isSelected && (
                  <rect
                    x={MARGIN.left + i * WEEK_SLOT_W + 2}
                    y={ecTop}
                    width={WEEK_SLOT_W - 4}
                    height={ecInnerH + GAP_BETWEEN_CHARTS + phInnerH}
                    rx={6}
                    fill="rgba(34,211,238,0.06)"
                    stroke="rgba(34,211,238,0.25)"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
                {(isSelected || isPlayhead) && (
                  <rect
                    x={MARGIN.left + i * WEEK_SLOT_W + 2}
                    y={ecTop}
                    width={WEEK_SLOT_W - 4}
                    height={ecInnerH + GAP_BETWEEN_CHARTS + phInnerH}
                    rx={6}
                    fill={isSelected ? 'rgba(34,211,238,0.08)' : 'rgba(251,191,36,0.06)'}
                    stroke={isSelected ? 'rgba(34,211,238,0.35)' : 'rgba(251,191,36,0.25)'}
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
                <rect
                  x={barX}
                  y={yTop}
                  width={BAR_W}
                  height={Math.max(barH, 4)}
                  rx={4}
                  fill="url(#ecBarGrad)"
                  filter={isSelected ? 'url(#barGlow)' : undefined}
                  className="transition-all duration-300"
                  pointerEvents="none"
                />
                <text
                  x={cx}
                  y={yTop - 6}
                  textAnchor="middle"
                  className={`text-[10px] font-bold tabular-nums ${
                    isSelected ? 'fill-emerald-300' : 'fill-emerald-400/90'
                  }`}
                  pointerEvents="none"
                >
                  {w.ecSetpointUsCm}
                </text>
              </g>
            );
          })}

          {/* Playhead line */}
          {weeks.map((w, i) =>
            w.weekIndex === playheadWeek ? (
              <line
                key="playhead"
                x1={weekCenterX(i)}
                y1={ecTop - 4}
                x2={weekCenterX(i)}
                y2={phTop + phInnerH + 8}
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="5 3"
                pointerEvents="none"
              />
            ) : null
          )}

          {/* X axis — week labels (between charts) */}
          {weeks.map((w, i) => {
            const cx = weekCenterX(i);
            const y = ecTop + ecInnerH + GAP_BETWEEN_CHARTS / 2 + 4;
            const isSelected = w.weekIndex === selectedWeek;
            return (
              <g key={`x-${w.weekIndex}`}>
                <text
                  x={cx}
                  y={y}
                  textAnchor="middle"
                  className={`text-[11px] font-semibold tabular-nums ${
                    isSelected
                      ? 'fill-aqua-300'
                      : w.weekIndex === playheadWeek
                        ? 'fill-amber-300'
                        : 'fill-dark-textSecondary'
                  }`}
                >
                  S{w.weekIndex}
                </text>
                {w.weekIndex === playheadWeek && (
                  <text
                    x={cx}
                    y={y + 12}
                    textAnchor="middle"
                    className="fill-amber-400/80 text-[8px]"
                  >
                    ▼ sim
                  </text>
                )}
              </g>
            );
          })}

          {/* ── pH chart ── */}
          <text
            x={MARGIN.left - 8}
            y={phTop - 12}
            textAnchor="end"
            className="fill-violet-400 text-[11px] font-semibold"
          >
            pH alvo
          </text>

          {weeks.map((w, i) => (
            <rect
              key={`ph-bg-${w.weekIndex}`}
              x={MARGIN.left + i * WEEK_SLOT_W}
              y={phTop}
              width={WEEK_SLOT_W}
              height={phInnerH}
              fill={PHASE_FILL[w.phase]}
              opacity={0.6}
            />
          ))}

          {phTicks.map((tick) => {
            const y = phTop + phToY(tick, phInnerH);
            return (
              <g key={`ph-tick-${tick}`}>
                <line
                  x1={MARGIN.left}
                  y1={y}
                  x2={chartW - MARGIN.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-dark-textSecondary text-[10px] tabular-nums"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {weeks.map((w, i) => {
            const cx = weekCenterX(i);
            const barX = cx - BAR_W / 2;
            const yTop = phTop + phToY(w.phSetpoint, phInnerH);
            const barH = phTop + phInnerH - yTop;
            const isSelected = w.weekIndex === selectedWeek;

            return (
              <g key={`ph-bar-${w.weekIndex}`}>
                <rect
                  x={barX}
                  y={yTop}
                  width={BAR_W}
                  height={Math.max(barH, 4)}
                  rx={4}
                  fill="url(#phBarGrad)"
                  filter={isSelected ? 'url(#phGlow)' : undefined}
                  className="transition-all duration-300"
                  pointerEvents="none"
                />
                <text
                  x={cx}
                  y={yTop - 6}
                  textAnchor="middle"
                  className={`text-[10px] font-bold tabular-nums ${
                    isSelected ? 'fill-violet-300' : 'fill-violet-400/90'
                  }`}
                  pointerEvents="none"
                >
                  {w.phSetpoint.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={MARGIN.left}
            y1={ecTop + ecInnerH}
            x2={chartW - MARGIN.right}
            y2={ecTop + ecInnerH}
            stroke="rgba(255,255,255,0.12)"
          />
          <line
            x1={MARGIN.left}
            y1={phTop + phInnerH}
            x2={chartW - MARGIN.right}
            y2={phTop + phInnerH}
            stroke="rgba(255,255,255,0.12)"
          />
        </svg>
      </div>

      {hoverMetrics && hoveredWeek != null && (
        <GrowCycleWeekHoverTooltip
          metrics={hoverMetrics}
          pointer={pointer}
          deviceId={deviceId}
        />
      )}

      {/* Event lanes */}
      <div className="border-t border-dark-border px-4 py-4 space-y-3 bg-dark-surface/30">
        <div className="overflow-x-auto">
          <div
            className="min-w-[640px] grid gap-1"
            style={{
              gridTemplateColumns: `52px repeat(${weeks.length}, ${WEEK_SLOT_W}px)`,
            }}
          >
            <div className="text-[10px] text-dark-textSecondary self-center font-medium">
              P2/P3
            </div>
            {weeks.map((w) => (
              <div key={`p23-${w.weekIndex}`} className="flex justify-center">
                {plan.autoEcPhEnabled ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    ON
                  </span>
                ) : (
                  <span className="text-dark-textSecondary text-[9px]">—</span>
                )}
              </div>
            ))}

            <div className="text-[10px] text-dark-textSecondary self-center font-medium">
              P1
            </div>
            {weeks.map((w) => {
              const events = getTankEventsForWeek(plan, w.weekIndex);
              return (
                <div
                  key={`p1-${w.weekIndex}`}
                  className="flex flex-wrap gap-0.5 justify-center items-center min-h-[24px]"
                >
                  {events.map((ev) => (
                    <span
                      key={ev.ruleIdSuggested}
                      title={ev.description}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-white/10"
                      style={{
                        color: tankEventColor(ev.kind),
                        backgroundColor: `${tankEventColor(ev.kind)}18`,
                      }}
                    >
                      {tankEventLabel(ev.kind)}
                    </span>
                  ))}
                </div>
              );
            })}

            <div className="text-[10px] text-dark-textSecondary self-center font-medium">
              P4
            </div>
            {weeks.map((w) => {
              const scheds = getSchedulesForWeek(plan, w.weekIndex);
              return (
                <div
                  key={`p4-${w.weekIndex}`}
                  className="flex flex-col gap-0.5 items-center"
                >
                  {scheds.map((s) => (
                    <span
                      key={s.ruleId + s.label}
                      className="text-[8px] text-cyan-400/80 whitespace-nowrap"
                      title={`${s.label} (${s.cadence})`}
                    >
                      {s.label === 'Circulação' ? '⟳ 2h' : 'UC Dom'}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-dark-border/50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" />
            <span className="text-[10px] text-dark-textSecondary">EC µS/cm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-violet-600 to-violet-400" />
            <span className="text-[10px] text-dark-textSecondary">pH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 border-t-2 border-dashed border-amber-400" />
            <span className="text-[10px] text-dark-textSecondary">Playhead simulado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
