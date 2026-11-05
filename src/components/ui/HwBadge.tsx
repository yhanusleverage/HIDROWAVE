'use client';

import React from 'react';
import { HW_BADGE, type HwAccent } from '@/lib/design-tokens';

export interface HwBadgeProps {
  accent?: HwAccent;
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm';
}

export function HwBadge({ accent = 'neutral', children, className = '', size = 'xs' }: HwBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${HW_BADGE[accent]} ${className}`}
    >
      {children}
    </span>
  );
}
