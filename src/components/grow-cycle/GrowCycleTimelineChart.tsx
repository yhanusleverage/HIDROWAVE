'use client';

import { useCallback, useRef, useState } from 'react';
import type { GrowCyclePlan, GrowWeekProfile } from '@/lib/grow-cycle-timeline/types';
import {
  PHASE_COLORS,
  PHASE_LABELS,
} from '@/lib/grow-cycle-timeline/types';
import {
  getTankEventsForWeek,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import { GrowCycleWeekHoverTooltip } from '@/components/grow-cycle/GrowCycleWeekHoverTooltip';
import { useGrowCycleWeekHoverMetrics } from '@/hooks/useGrowCycleWeekHoverMetrics';
import { useGrowCycleTimelineLayout } from '@/hooks/useGrowCycleTimelineLayout';
import type { GrowCycleWeeklyStatsRow } from '@/lib/grow-cycle-plans/types';
import {
  EC_CHART_H,
  GAP_BETWEEN_CHARTS,
  LANE_LABEL_COL_W,
  PH_CHART_H,
  TIMELINE_MARGIN,
} from '@/lib/grow-cycle-timeline/layout-constants';

import {
  ScheduleLaneRow,
  SchedulesP0Lane,
  ScheduleLegend,
} from '@/components/grow-cycle/ScheduleLaneRow';
import { TimelineFlexRow, TimelineWeekSlot } from '@/components/grow-cycle/TimelineGridRow';

import type { ScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';

export type { ScheduleUiVersion };

interface GrowCycleTimelineChartProps {
  plan: GrowCyclePlan;
  selectedWeek: number;
  playheadWeek: number;
  onSelectWeek: (week: number) => void;
  deviceId?: string | null;
  weeklyStats?: GrowCycleWeeklyStatsRow[];
  scheduleUiVersion?: ScheduleUiVersion;
}

const MARGIN = TIMELINE_MARGIN;
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
  weeklyStats = [],
  scheduleUiVersion = 'p1',
}: GrowCycleTimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ clientX: 0, clientY: 0 });

  const hoverMetrics = useGrowCycleWeekHoverMetrics(plan, hoveredWeek, deviceId);

  const weeks = plan.weeks.filter((w) => w.weekIndex <= plan.totalWeeks);
  const { weekSlotW, chartW, barW, scrollMode } = useGrowCycleTimelineLayout(
    containerRef,
    weeks.length
  );

  const weeksTrackW = weeks.length * weekSlotW;

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

  const ecInnerH = EC_CHART_H;
  const phInnerH = PH_CHART_H;
  const ecTop = MARGIN.top;
  const phTop = ecTop + ecInnerH + GAP_BETWEEN_CHARTS;
  const totalH = phTop + phInnerH + MARGIN.bottom + 72;

  const ecTicks = [0, 500, 1000, 1500, 2000];
  const phTicks = [5.0, 5.5, 6.0, 6.5];

  const weekCenterX = (i: number) =>
    MARGIN.left + i * weekSlotW + weekSlotW / 2;

  return (
    <div
      ref={containerRef}
      className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-lg shadow-black/20 w-full min-w-0"
    >
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-wider text-dark-textSecondary font-semibold">
          Fases do ciclo
        </p>
      </div>

      <div className="relative">
        {scrollMode && (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-dark-card to-transparent pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-dark-card to-transparent pointer-events-none"
              aria-hidden
            />
          </>
        )}

        <div
          className={`timeline-scroll w-full min-w-0 max-w-full ${scrollMode ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
          aria-label={scrollMode ? 'Timeline — rolagem horizontal' : undefined}
        >
          <div className="max-w-full" style={{ width: chartW, minWidth: chartW }}>
            {/* Phase ribbon — flex track matching SVG week columns */}
            <div className="pb-2 mb-1 border-b border-dark-border/60">
              <div
                className="flex h-7 rounded-lg overflow-hidden border border-dark-border"
                style={{ width: chartW, minWidth: chartW }}
              >
                <div
                  aria-hidden
                  className="shrink-0"
                  style={{ width: LANE_LABEL_COL_W, minWidth: LANE_LABEL_COL_W }}
                />
                <div className="flex shrink-0 h-full" style={{ width: weeksTrackW, minWidth: weeksTrackW }}>
                  {weeks.map((w, i) => (
                    <button
                      key={`phase-${w.weekIndex}`}
                      type="button"
                      onClick={() => onSelectWeek(w.weekIndex)}
                      title={PHASE_LABELS[w.phase]}
                      className={`h-full text-[9px] font-medium border-r border-dark-border/50 transition-opacity hover:opacity-90 shrink-0 ${PHASE_COLORS[w.phase]} ${
                        w.weekIndex === selectedWeek ? 'ring-2 ring-inset ring-aqua-400/60 z-[1]' : ''
                      } ${i === weeks.length - 1 ? 'border-r-0' : ''}`}
                      style={{ width: weekSlotW, minWidth: weekSlotW, maxWidth: weekSlotW }}
                    >
                      <span className="truncate px-0.5 block text-center leading-7">
                        {PHASE_LABELS[w.phase].slice(0, 3)}
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  aria-hidden
                  className="shrink-0"
                  style={{ width: TIMELINE_MARGIN.right, minWidth: TIMELINE_MARGIN.right }}
                />
              </div>
            </div>

          <svg
            width={chartW}
            height={totalH}
            className="select-none block"
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
              x={MARGIN.left + i * weekSlotW}
              y={ecTop}
              width={weekSlotW}
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
            const barX = cx - barW / 2;
            const yTop = ecTop + ecToY(w.ecSetpointUsCm, ecInnerH);
            const barH = ecTop + ecInnerH - yTop;
            const isSelected = w.weekIndex === selectedWeek;
            const isPlayhead = w.weekIndex === playheadWeek;
            const isHovered = w.weekIndex === hoveredWeek;
            const measured = weeklyStats.find((s) => s.week_index === w.weekIndex);
            const measuredEc = measured?.ec_avg != null ? Number(measured.ec_avg) : null;
            const measuredY =
              measuredEc != null ? ecTop + ecToY(measuredEc, ecInnerH) : null;

            return (
              <g key={`ec-bar-${w.weekIndex}`}>
                {/* Hit area */}
                <rect
                  x={MARGIN.left + i * weekSlotW}
                  y={ecTop}
                  width={weekSlotW}
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
                    x={MARGIN.left + i * weekSlotW + 2}
                    y={ecTop}
                    width={weekSlotW - 4}
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
                    x={MARGIN.left + i * weekSlotW + 2}
                    y={ecTop}
                    width={weekSlotW - 4}
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
                  width={barW}
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
                {measuredY != null && measuredEc != null && (
                  <>
                    <circle
                      cx={cx + barW / 2 + 6}
                      cy={measuredY}
                      r={4}
                      fill="#fbbf24"
                      stroke="#78350f"
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                    <title>{`EC medido: ${Math.round(measuredEc)} µS/cm`}</title>
                  </>
                )}
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
              x={MARGIN.left + i * weekSlotW}
              y={phTop}
              width={weekSlotW}
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
            const barX = cx - barW / 2;
            const yTop = phTop + phToY(w.phSetpoint, phInnerH);
            const barH = phTop + phInnerH - yTop;
            const isSelected = w.weekIndex === selectedWeek;

            return (
              <g key={`ph-bar-${w.weekIndex}`}>
                <rect
                  x={barX}
                  y={yTop}
                  width={barW}
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

          {/* Event lanes — flex rows with exact px widths (same as SVG) */}
          <div className="border-t border-dark-border py-4 space-y-1.5 bg-dark-surface/30">
            <TimelineFlexRow
              chartW={chartW}
              weekSlotW={weekSlotW}
              weekCount={weeks.length}
              label="P2/P3"
            >
              {weeks.map((w) => (
                <TimelineWeekSlot key={`p23-${w.weekIndex}`} weekSlotW={weekSlotW} className="flex justify-center">
                  {plan.autoEcPhEnabled ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      ON
                    </span>
                  ) : (
                    <span className="text-dark-textSecondary text-[9px]">—</span>
                  )}
                </TimelineWeekSlot>
              ))}
            </TimelineFlexRow>

            <TimelineFlexRow
              chartW={chartW}
              weekSlotW={weekSlotW}
              weekCount={weeks.length}
              label="P1"
            >
              {weeks.map((w) => {
                const events = getTankEventsForWeek(plan, w.weekIndex);
                return (
                  <TimelineWeekSlot
                    key={`p1-${w.weekIndex}`}
                    weekSlotW={weekSlotW}
                    className="flex flex-wrap gap-0.5 justify-center items-center min-h-[24px] content-center"
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
                  </TimelineWeekSlot>
                );
              })}
            </TimelineFlexRow>

            {scheduleUiVersion === 'p0' ? (
              <SchedulesP0Lane
                plan={plan}
                chartW={chartW}
                weekSlotW={weekSlotW}
                weekCount={weeks.length}
              />
            ) : (
              <ScheduleLaneRow
                plan={plan}
                chartW={chartW}
                weekSlotW={weekSlotW}
                weekCount={weeks.length}
              />
            )}
          </div>
        </div>
        </div>
      </div>

      {hoverMetrics && hoveredWeek != null && (
        <GrowCycleWeekHoverTooltip
          metrics={hoverMetrics}
          pointer={pointer}
          deviceId={deviceId}
        />
      )}

      <div className="px-4 pb-4 border-t border-dark-border/50 bg-dark-surface/30">
        <div className="flex flex-wrap items-center gap-4 pt-3">
          {scheduleUiVersion === 'p1' && <ScheduleLegend />}
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
