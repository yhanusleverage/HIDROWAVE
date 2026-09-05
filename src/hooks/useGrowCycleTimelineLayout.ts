'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  DEFAULT_WEEK_SLOT_W,
  LANE_LABEL_COL_W,
  MAX_WEEK_SLOT_W,
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

  // Nunca esmagar: mínimo DEFAULT; se content > viewport → scroll.
  // Com poucas semanas, pode crescer até MAX para preencher a caixa.
  const weekSlotW = Math.min(
    MAX_WEEK_SLOT_W,
    Math.max(DEFAULT_WEEK_SLOT_W, idealSlotW)
  );

  const contentW =
    TIMELINE_MARGIN.left + safeWeekCount * weekSlotW + TIMELINE_MARGIN.right;
  const scrollMode = contentW > containerWidth + 0.5;
  // Em scroll: largura = conteúdo. Sem scroll: preenche a caixa fixa.
  const chartW = scrollMode ? contentW : Math.max(containerWidth, contentW);

  const barW = Math.min(22, Math.max(10, weekSlotW * 0.32));

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

export { DEFAULT_WEEK_SLOT_W, TIMELINE_MARGIN };
