'use client';

import React from 'react';
import { HW_BADGE, type HwAccent } from '@/lib/design-tokens';

export interface HwBadgeProps {
  accent?: HwAccent;
  children: React.ReactNode;
  className?: string;
}

export function HwBadge({ accent = 'neutral', children, className = '' }: HwBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${HW_BADGE[accent]} ${className}`}
    >
      {children}
    </span>
  );
}
