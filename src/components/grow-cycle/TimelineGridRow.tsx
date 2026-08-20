'use client';

import type { CSSProperties, ReactNode } from 'react';
import { LANE_LABEL_COL_W, TIMELINE_MARGIN } from '@/lib/grow-cycle-timeline/layout-constants';

interface TimelineWeekSlotProps {
  weekSlotW: number;
  children: ReactNode;
  className?: string;
}

/** Fixed-width cell — matches SVG week column (MARGIN.left + i * weekSlotW). */
export function TimelineWeekSlot({ weekSlotW, children, className = '' }: TimelineWeekSlotProps) {
  const style: CSSProperties = {
    width: weekSlotW,
    minWidth: weekSlotW,
    maxWidth: weekSlotW,
    flex: '0 0 auto',
  };

  return (
    <div className={`min-w-0 overflow-hidden ${className}`} style={style}>
      {children}
    </div>
  );
}

interface TimelineFlexRowProps {
  chartW: number;
  weekSlotW: number;
  weekCount: number;
  label: ReactNode;
  labelClassName?: string;
  children: ReactNode;
  className?: string;
}

/** Event-lane row using flex + exact px widths (same math as SVG). */
export function TimelineFlexRow({
  chartW,
  weekSlotW,
  weekCount,
  label,
  labelClassName = '',
  children,
  className = '',
}: TimelineFlexRowProps) {
  const weeksTrackW = weekCount * weekSlotW;

  return (
    <div
      className={`flex items-center ${className}`}
      style={{ width: chartW, minWidth: chartW, maxWidth: chartW }}
    >
      <div
        className={`shrink-0 text-[10px] text-dark-textSecondary self-center font-medium min-w-0 ${labelClassName}`}
        style={{ width: LANE_LABEL_COL_W, minWidth: LANE_LABEL_COL_W }}
      >
        {label}
      </div>
      <div className="flex shrink-0" style={{ width: weeksTrackW, minWidth: weeksTrackW }}>
        {children}
      </div>
      <div
        aria-hidden
        className="shrink-0"
        style={{ width: TIMELINE_MARGIN.right, minWidth: TIMELINE_MARGIN.right }}
      />
    </div>
  );
}

/** @deprecated Use TimelineFlexRow — kept for import stability during migration. */
export const TimelineGridRow = TimelineFlexRow;
