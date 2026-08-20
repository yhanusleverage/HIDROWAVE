'use client';

import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import { getSchedulesForWeek } from '@/lib/grow-cycle-timeline/simulation-engine';
import {
  resolveScheduleKind,
  scheduleIsRecurring,
  SCHEDULE_KIND_LABELS,
} from '@/lib/grow-cycle-timeline/schedule-tokens';
import { LANE_LABEL_COL_W } from '@/lib/grow-cycle-timeline/layout-constants';
import { HW_TEXT } from '@/lib/design-tokens';
import { ScheduleChip } from '@/components/grow-cycle/ScheduleChip';
import { TimelineFlexRow, TimelineWeekSlot } from '@/components/grow-cycle/TimelineGridRow';

const LANE_LABEL_W = LANE_LABEL_COL_W;

interface ScheduleLaneRowProps {
  plan: GrowCyclePlan;
  chartW: number;
  weekSlotW: number;
  weekCount: number;
}

/** P0 legacy — plain text labels (preserved for ?scheduleUi=p0). */
export function SchedulesP0Lane({ plan, chartW, weekSlotW, weekCount }: ScheduleLaneRowProps) {
  const weeks = plan.weeks.filter((w) => w.weekIndex <= plan.totalWeeks);

  return (
    <TimelineFlexRow chartW={chartW} weekSlotW={weekSlotW} weekCount={weekCount} label="P4">
      {weeks.map((w) => {
        const scheds = getSchedulesForWeek(plan, w.weekIndex);
        return (
          <TimelineWeekSlot
            key={`p4-p0-${w.weekIndex}`}
            weekSlotW={weekSlotW}
            className="flex flex-col gap-0.5 items-center"
          >
            {scheds.map((s) => (
              <span
                key={s.ruleId + s.label}
                className="text-[8px] text-cyan-400/80 truncate max-w-full text-center"
                title={`${s.label} (${s.cadence})`}
              >
                {s.label === 'Circulação' ? '⟳ 2h' : 'UC Dom'}
              </span>
            ))}
          </TimelineWeekSlot>
        );
      })}
    </TimelineFlexRow>
  );
}

/** P1 — chip-based schedule lane with mini-bars. */
export function ScheduleLaneRow({ plan, chartW, weekSlotW, weekCount }: ScheduleLaneRowProps) {
  const weeks = plan.weeks.filter((w) => w.weekIndex <= plan.totalWeeks);

  return (
    <TimelineFlexRow
      chartW={chartW}
      weekSlotW={weekSlotW}
      weekCount={weekCount}
      label={
        <>
          <span className="block">P4</span>
          <span className="block text-[8px] font-normal text-dark-textSecondary">Agend.</span>
        </>
      }
      labelClassName={`font-semibold leading-tight ${HW_TEXT.wait}`}
    >
      {weeks.map((w) => {
        const scheds = getSchedulesForWeek(plan, w.weekIndex);
        return (
          <TimelineWeekSlot
            key={`p4-p1-${w.weekIndex}`}
            weekSlotW={weekSlotW}
            className="flex flex-col gap-1 items-center min-h-[28px] justify-start"
          >
            {scheds.map((s) => {
              const kind = resolveScheduleKind(s);
              const recurring = scheduleIsRecurring(kind);
              return (
                <div key={s.ruleId + s.label} className="w-full flex flex-col items-center gap-0.5 min-w-0">
                  <ScheduleChip schedule={s} variant="compact" className="w-full justify-center max-w-full" />
                  <div
                    className={`h-1 w-full max-w-[min(44px,80%)] rounded-full ${
                      recurring
                        ? 'border border-dashed border-cyan-500/50 bg-cyan-500/10'
                        : 'bg-aqua-500/40'
                    }`}
                    title={recurring ? 'Recorrente na semana' : 'Evento pontual'}
                    aria-hidden
                  />
                </div>
              );
            })}
          </TimelineWeekSlot>
        );
      })}
    </TimelineFlexRow>
  );
}

export function ScheduleLegend() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm border border-dashed border-cyan-500/50 bg-cyan-500/15" />
        <span className="text-[10px] text-dark-textSecondary">
          {SCHEDULE_KIND_LABELS.circulation}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm bg-aqua-500/25 border border-aqua-500/40" />
        <span className="text-[10px] text-dark-textSecondary">
          {SCHEDULE_KIND_LABELS.maintenance}
        </span>
      </div>
    </>
  );
}

export { LANE_LABEL_W };
