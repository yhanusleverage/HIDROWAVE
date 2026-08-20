'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  DEFAULT_WEEK_SLOT_W,
  LANE_LABEL_COL_W,
  MIN_WEEK_SLOT_W,
  TIMELINE_MARGIN,
} from '@/lib/grow-cycle-timeline/layout-constants';

export interface GrowCycleTimelineLayout {
  weekSlotW: number;
  chartW: number;
  /** Total drawable width (margins + week columns). */
  contentW: number;
  containerWidth: number;
  barW: number;
  scrollMode: boolean;
  labelColW: number;
}

function computeLayout(containerWidth: number, weekCount: number): GrowCycleTimelineLayout {
  const safeWeekCount = Math.max(weekCount, 1);
  const innerW = Math.max(0, containerWidth - TIMELINE_MARGIN.left - TIMELINE_MARGIN.right);
  const idealSlotW = innerW / safeWeekCount;

  let weekSlotW: number;
  if (idealSlotW < MIN_WEEK_SLOT_W) {
    weekSlotW = MIN_WEEK_SLOT_W;
  } else {
    weekSlotW = idealSlotW;
  }

  const contentW =
    TIMELINE_MARGIN.left + safeWeekCount * weekSlotW + TIMELINE_MARGIN.right;
  const scrollMode = contentW > containerWidth + 0.5;
  const chartW = scrollMode ? contentW : containerWidth;

  const barW = Math.min(16, Math.max(8, weekSlotW * 0.28));

  return {
    weekSlotW,
    chartW,
    contentW,
    containerWidth,
    barW,
    scrollMode,
    labelColW: LANE_LABEL_COL_W,
  };
}

const FALLBACK_WIDTH = 640;

function readElementWidth(el: HTMLElement): number {
  const w = el.clientWidth;
  return w > 0 ? w : 0;
}

export function useGrowCycleTimelineLayout(
  containerRef: RefObject<HTMLElement | null>,
  weekCount: number
): GrowCycleTimelineLayout {
  const [layout, setLayout] = useState<GrowCycleTimelineLayout>(() =>
    computeLayout(FALLBACK_WIDTH, weekCount)
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;

    const update = (width: number) => {
      if (width <= 0) return;
      setLayout(computeLayout(width, weekCount));
    };

    const scheduleUpdate = (width: number) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => update(width));
    };

    const measure = () => scheduleUpdate(readElementWidth(el));

    measure();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width =
        entry.contentBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width;
      scheduleUpdate(width);
    });
    ro.observe(el);

    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, weekCount]);

  return layout;
}

export { DEFAULT_WEEK_SLOT_W, MIN_WEEK_SLOT_W, TIMELINE_MARGIN };
