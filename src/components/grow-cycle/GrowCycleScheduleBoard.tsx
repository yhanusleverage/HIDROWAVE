'use client';

import { useMemo, useState } from 'react';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import type { LiveScheduleRow } from '@/lib/grow-cycle-timeline/live-schedule-blocks';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGrowCycleChrome } from '@/lib/translations/grow-cycle';

const DAY_W = 48;

type Tone = 'fill' | 'change' | 'drain' | 'ec' | 'ph' | 'time';

interface BoardBlock {
  id: string;
  priority: 1 | 2 | 3 | 4;
  startDay: number;
  spanDays: number;
  title: string;
  lines: string[];
  tone: Tone;
  row: number;
  /** Id completo de la regla, para copiar. */
  ruleId?: string;
  /** Nombre visible. La tarjeta no se borra al abrirlo. */
  ruleName?: string;
  /** Cita ya disparada: sigue en la agenda, más tenue. */
  dimmed?: boolean;
}

const TONE_CLASS: Record<Tone, string> = {
  fill: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100',
  change: 'border-amber-400/50 bg-amber-500/15 text-amber-100',
  drain: 'border-rose-400/50 bg-rose-500/15 text-rose-100',
  ec: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  ph: 'border-violet-400/40 bg-violet-500/10 text-violet-100',
  time: 'border-slate-400/40 bg-slate-500/10 text-slate-100',
};

const RAIL: Record<BoardBlock['priority'], string> = {
  1: 'bg-sky-500',
  2: 'bg-emerald-500',
  3: 'bg-violet-500',
  4: 'bg-slate-500',
};

interface GrowCycleScheduleBoardProps {
  plan: GrowCyclePlan;
  demo: boolean;
  /** Nombre amigable del Core. El id ESP32_HIDRO_… no se muestra. */
  deviceName?: string | null;
  liveRows: LiveScheduleRow[];
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
}

function withRows(blocks: Omit<BoardBlock, 'row'>[]): BoardBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => a.priority - b.priority || a.startDay - b.startDay || b.spanDays - a.spanDays
  );
  const ends = new Map<number, number[]>();
  return sorted.map((block) => {
    const lane = ends.get(block.priority) ?? [];
    const end = block.startDay + block.spanDays;
    let row = lane.findIndex((usedUntil) => usedUntil <= block.startDay);
    if (row < 0) {
      row = lane.length;
      lane.push(end);
    } else {
      lane[row] = end;
    }
    ends.set(block.priority, lane);
    return { ...block, row };
  });
}

function livePriority(ruleId: string): { priority: 1 | 2 | 3 | 4; tone: Tone; pill: string } {
  const id = ruleId.toLowerCase();
  if (id.includes('drain') || id.includes('dreno')) {
    return { priority: 1, tone: 'drain', pill: 'DRAIN' };
  }
  if (id.includes('change') || id.includes('changeout')) {
    return { priority: 1, tone: 'change', pill: 'CHANGEOUT' };
  }
  if (id.includes('fill') || id.includes('llen') || id.includes('dose')) {
    return { priority: 1, tone: 'fill', pill: 'FILL + DOSE' };
  }
  if (id.includes('ph')) return { priority: 3, tone: 'ph', pill: 'PH' };
  if (id.includes('ec') || id.includes('nutri')) return { priority: 2, tone: 'ec', pill: 'EC' };
  return { priority: 4, tone: 'time', pill: 'TIME' };
}

function pushWeekTargets(
  out: Omit<BoardBlock, 'row'>[],
  plan: GrowCyclePlan,
  ecRule: string,
  phRule: string
) {
  for (const w of plan.weeks) {
    if (w.weekIndex > plan.totalWeeks) continue;
    const lines = [`${Math.round(w.ecSetpointUsCm)} µS/cm`];
    if (w.tankVolumeL != null) lines.push(`${w.tankVolumeL} L`);
    out.push({
      id: `ec-${w.weekIndex}`,
      priority: 2,
      startDay: w.weekIndex * 7,
      spanDays: 7,
      title: ecRule,
      lines,
      tone: 'ec',
    });
    out.push({
      id: `ph-${w.weekIndex}`,
      priority: 3,
      startDay: w.weekIndex * 7,
      spanDays: 7,
      title: phRule,
      lines: [w.phSetpoint.toFixed(1)],
      tone: 'ph',
    });
  }
}

function blocksForPlan(
  plan: GrowCyclePlan,
  demo: boolean,
  rows: LiveScheduleRow[],
  labels: {
    fillDose: string;
    changeout: string;
    drainFull: string;
    ecRule: string;
    phRule: string;
  }
): BoardBlock[] {
  const out: Omit<BoardBlock, 'row'>[] = [];
  const span = (plan.totalWeeks + 1) * 7;

  if (demo) {
    for (const ev of plan.tankEvents) {
      if (ev.weekIndex > plan.totalWeeks) continue;
      const tone: Tone =
        ev.kind === 'initial_fill' ? 'fill' : ev.kind === 'drain_full' ? 'drain' : 'change';
      const title =
        ev.kind === 'initial_fill'
          ? labels.fillDose
          : ev.kind === 'drain_full'
            ? labels.drainFull
            : labels.changeout;
      const wide = ev.kind !== 'initial_fill';
      out.push({
        id: ev.ruleIdSuggested,
        priority: 1,
        startDay: ev.weekIndex * 7 + (wide ? 1 : 0),
        spanDays: ev.kind === 'initial_fill' ? 3 : 5,
        title,
        lines: [ev.triggerTime],
        tone,
        ruleId: ev.ruleIdSuggested,
        ruleName: title,
      });
    }
    for (const s of plan.schedules) {
      if (s.weekIndex > plan.totalWeeks) continue;
      out.push({
        id: `${s.ruleId}-${s.weekIndex}`,
        priority: 4,
        startDay: s.weekIndex * 7,
        spanDays: 7,
        title: s.label,
        lines: [s.cadence],
        tone: 'time',
        ruleId: s.ruleId,
        ruleName: s.label,
      });
    }
  } else {
    let onceCursor = 0;
    for (const row of rows) {
      const kind = livePriority(row.rule_id);
      const name =
        row.rule_name?.trim() ||
        row.rule_id.replace(/^SCHEDULE_/, '').replace(/_/g, ' ');
      const time = row.time_start.length >= 5 ? row.time_start.slice(0, 5) : row.time_start;
      const lines = [name, row.on_date ? `${time} · ${row.on_date}` : time];
      const stamp = {
        ruleId: row.rule_id,
        ruleName: name,
        dimmed: !row.enabled,
      };
      if (row.schedule_type === 'grow_week' && row.grow_week_index != null) {
        out.push({
          id: row.id,
          priority: kind.priority,
          startDay: row.grow_week_index * 7,
          spanDays: 6,
          title: kind.pill,
          lines,
          tone: kind.tone,
          ...stamp,
        });
      } else if (row.schedule_type === 'daily') {
        out.push({
          id: row.id,
          priority: kind.priority,
          startDay: 0,
          spanDays: Math.min(span, 7),
          title: kind.pill,
          lines,
          tone: kind.tone,
          ...stamp,
        });
      } else if (row.schedule_type === 'weekly') {
        const days = row.days_of_week?.length ? row.days_of_week : [0];
        for (let w = 0; w <= plan.totalWeeks; w++) {
          for (const d of days) {
            out.push({
              id: `${row.id}-w${w}-d${d}`,
              priority: kind.priority,
              startDay: w * 7 + (d % 7),
              spanDays: 2,
              title: kind.pill,
              lines,
              tone: kind.tone,
              ...stamp,
            });
          }
        }
      } else {
        out.push({
          id: row.id,
          priority: kind.priority,
          startDay: onceCursor,
          spanDays: 3,
          title: kind.pill,
          lines,
          tone: kind.tone,
          ...stamp,
        });
        onceCursor += 3;
      }
    }
  }

  if (demo) pushWeekTargets(out, plan, labels.ecRule, labels.phRule);
  return withRows(out);
}

export function GrowCycleScheduleBoard({
  plan,
  demo,
  deviceName,
  liveRows,
  selectedWeek,
  onSelectWeek,
}: GrowCycleScheduleBoardProps) {
  const { locale } = useLanguage();
  const gc = useMemo(() => getGrowCycleChrome(locale), [locale]);
  const weekCount = plan.totalWeeks + 1;
  const choices = [4, 5, 8].filter((n) => n < weekCount);
  const [viewWeeks, setViewWeeks] = useState(Math.min(5, weekCount));
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const visible = viewWeeks >= weekCount ? weekCount : viewWeeks;
  const maxStart = Math.max(0, weekCount - visible);
  const startWeek = Math.min(selectedWeek, maxStart);

  const blocks = useMemo(
    () =>
      blocksForPlan(plan, demo, liveRows, {
        fillDose: gc.fillDose,
        changeout: gc.changeout,
        drainFull: gc.drainFull,
        ecRule: gc.ecRule,
        phRule: gc.phRule,
      }),
    [plan, demo, liveRows, gc.fillDose, gc.changeout, gc.drainFull, gc.ecRule, gc.phRule]
  );

  const windowStartDay = startWeek * 7;
  const windowDays = visible * 7;
  const trackW = windowDays * DAY_W;
  const weeks = Array.from({ length: visible }, (_, i) => startWeek + i);
  const openBlock = openId ? blocks.find((block) => block.id === openId) ?? null : null;

  const laneBlocks = (priority: BoardBlock['priority']) =>
    blocks.filter((b) => {
      if (b.priority !== priority) return false;
      const end = b.startDay + b.spanDays;
      return end > windowStartDay && b.startDay < windowStartDay + windowDays;
    });

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl shadow-lg shadow-black/20 w-full min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-2">
        <p className="text-sm tracking-wide text-dark-textSecondary font-semibold">
          {(deviceName && deviceName.trim()) || (demo ? plan.name : '')}
        </p>
        <label className="flex items-center gap-2 text-sm text-dark-textSecondary">
          {gc.viewWeeksLabel}
          <select
            className="bg-dark-surface border border-dark-border rounded-md px-2 py-1 text-dark-text"
            value={visible >= weekCount ? 'all' : String(visible)}
            onChange={(e) => {
              const v = e.target.value;
              setViewWeeks(v === 'all' ? weekCount : Number(v));
            }}
          >
            {choices.map((n) => (
              <option key={n} value={n}>
                {gc.viewWeeksOption.replace('{n}', String(n))}
              </option>
            ))}
            <option value="all">{gc.viewAllWeeks}</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto overscroll-x-contain pb-4">
        <div className="px-3" style={{ minWidth: 96 + trackW }}>
          <div className="flex">
            <div className="w-16 shrink-0" />
            <div className="flex" style={{ width: trackW }}>
              {weeks.map((w) => (
                <button
                  key={`wh-${w}`}
                  type="button"
                  onClick={() => onSelectWeek(w)}
                  className={`text-sm font-semibold tracking-wide py-1.5 border-b ${
                    w === selectedWeek
                      ? 'text-aqua-300 border-aqua-400/70'
                      : 'text-dark-textSecondary border-dark-border/60'
                  }`}
                  style={{ width: DAY_W * 7 }}
                >
                  S{w}
                </button>
              ))}
            </div>
          </div>
          <div className="flex mb-1">
            <div className="w-16 shrink-0 text-xs font-semibold text-dark-textSecondary self-end pb-0.5 text-center leading-tight">
              {gc.boardStart}
            </div>
            <div className="flex" style={{ width: trackW }}>
              {weeks.map((w) =>
                Array.from({ length: 7 }, (_, d) => {
                  const dayNum = w * 7 + d + 1;
                  return (
                    <div
                      key={`d-${w}-${d}`}
                      className="text-xs text-center text-dark-textSecondary tabular-nums"
                      style={{ width: DAY_W }}
                    >
                      {dayNum}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {([1, 2, 3, 4] as const).map((priority) => {
            const items = laneBlocks(priority);
            const rows = items.reduce((max, block) => Math.max(max, block.row + 1), 1);
            return (
              <div key={priority} className="flex border-t border-dark-border/50">
                <div
                  className={`w-16 shrink-0 flex items-center justify-center ${RAIL[priority]}`}
                  title={gc.priorityLabel.replace('{n}', String(priority))}
                >
                  <span className="text-sm font-bold tracking-wide text-white [writing-mode:vertical-rl] rotate-180">
                    P{priority}
                  </span>
                </div>
                <div className="relative" style={{ width: trackW, height: Math.max(96, rows * 88 + 12) }}>
                  {items.length === 0 && (
                    <p className="absolute inset-0 flex items-center px-3 text-sm text-dark-textSecondary">
                      {gc.boardEmpty}
                    </p>
                  )}
                  {items.map((b) => {
                    const left = Math.max(0, b.startDay - windowStartDay) * DAY_W + 4;
                    const visibleSpan =
                      Math.min(b.startDay + b.spanDays, windowStartDay + windowDays) -
                      Math.max(b.startDay, windowStartDay);
                    const width = Math.max(DAY_W * 2, visibleSpan * DAY_W - 8);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          onSelectWeek(Math.floor(b.startDay / 7));
                          setCopied(false);
                          setOpenId((current) => (current === b.id ? null : b.id));
                        }}
                        className={`absolute rounded-lg border px-2.5 py-2 text-left overflow-hidden shadow-sm ${TONE_CLASS[b.tone]} ${
                          b.dimmed ? 'opacity-60' : ''
                        } ${openId === b.id ? 'ring-2 ring-aqua-300/80' : ''}`}
                        style={{ left, width, top: 8 + b.row * 88, height: 80 }}
                      >
                        <span className="inline-block max-w-full truncate text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-black/25">
                          {b.title}
                        </span>
                        {b.lines.filter(Boolean).slice(0, 2).map((line) => (
                          <span key={line} className="block text-sm tabular-nums truncate opacity-90 mt-1">
                            {line}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {openBlock && (
        <div className="mx-3 mb-3 rounded-xl border border-aqua-400/40 bg-dark-surface px-4 py-3 shadow-lg shadow-black/30">
          <p className="text-base font-semibold text-dark-text">
            {openBlock.ruleName || openBlock.title}
          </p>
          {openBlock.ruleId && (
            <p className="mt-1 font-mono text-sm text-aqua-300 select-all break-all">
              {openBlock.ruleId}
            </p>
          )}
          {openBlock.lines.filter(Boolean).map((line) => (
            <p key={line} className="text-sm text-dark-textSecondary mt-1">
              {line}
            </p>
          ))}
          <p className="text-xs text-dark-textSecondary mt-2">{gc.boardDetailHint}</p>
          {openBlock.ruleId && (
            <button
              type="button"
              className="mt-2 inline-flex px-3 py-1.5 rounded-lg border border-aqua-400/40 text-sm text-aqua-200 hover:bg-aqua-500/10"
              onClick={() => {
                const id = openBlock.ruleId;
                if (!id) return;
                void navigator.clipboard.writeText(id).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? gc.boardCopied : gc.boardCopyId}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
