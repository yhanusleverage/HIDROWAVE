'use client';

import React from 'react';
import { HW_ACCENT_LEFT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: HwAccent;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  accent = 'brand',
  className = '',
}: SectionHeaderProps) {
  return (
    <div
      className={`border-l-4 pl-3 mb-3 ${HW_ACCENT_LEFT[accent]} ${className}`}
    >
      <h4 className={`text-sm font-semibold ${HW_TEXT[accent]}`}>{title}</h4>
      {subtitle != null && (
        <p className="text-xs text-dark-textSecondary mt-0.5 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
