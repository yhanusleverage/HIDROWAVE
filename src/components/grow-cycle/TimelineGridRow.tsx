'use client';

import type { CSSProperties, ReactNode } from 'react';
import { LANE_LABEL_COL_W, TIMELINE_MARGIN } from '@/lib/grow-cycle-timeline/layout-constants';

interface TimelineWeekSlotProps {
  weekSlotW: number;
  children: ReactNode;
  className?: string;
}

/**
 * Fixed-width week cell — matches SVG week column.
 * Sem overflow-hidden: pastilhas usam truncate; não cortar o texto.
 */
export function TimelineWeekSlot({ weekSlotW, children, className = '' }: TimelineWeekSlotProps) {
  const style: CSSProperties = {
    width: weekSlotW,
    minWidth: weekSlotW,
    maxWidth: weekSlotW,
    flex: '0 0 auto',
  };

  return (
    <div className={`shrink-0 ${className}`} style={style}>
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

/** Event-lane row: label sticky à esquerda; track de semanas no scroll. */
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
      style={{ width: chartW, minWidth: chartW }}
    >
      <div
        className={`sticky left-0 z-20 shrink-0 self-stretch flex items-center bg-dark-surface/95 backdrop-blur-[2px] text-[10px] text-dark-textSecondary font-medium border-r border-dark-border/40 pl-1 pr-0.5 ${labelClassName}`}
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
