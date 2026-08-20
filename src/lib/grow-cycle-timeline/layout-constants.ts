/** Shared layout tokens for grow-cycle timeline (chart + event lanes). */

export const TIMELINE_MARGIN = { top: 48, right: 16, bottom: 36, left: 52 } as const;

export const LANE_LABEL_COL_W = 52;

export const DEFAULT_WEEK_SLOT_W = 56;

export const MIN_WEEK_SLOT_W = 44;

export const MAX_WEEK_SLOT_W = 96;

export const EC_CHART_H = 200;

export const PH_CHART_H = 120;

export const GAP_BETWEEN_CHARTS = 28;

/** @deprecated Use DEFAULT_WEEK_SLOT_W from layout-constants */
export const WEEK_SLOT_W = DEFAULT_WEEK_SLOT_W;

/** Shared CSS grid columns for phase ribbon, SVG alignment, and event lanes. */
export function buildTimelineGridColumns(weekCount: number, weekSlotW: number): string {
  const n = Math.max(weekCount, 1);
  return `${LANE_LABEL_COL_W}px repeat(${n}, ${weekSlotW}px) ${TIMELINE_MARGIN.right}px`;
}
