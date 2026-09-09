'use client';

import React from 'react';
import { HW_ACCENT_LEFT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: HwAccent;
  className?: string;
  /** comfortable ≈ lectura a 100% como zoom ~125% (Procedimentos). */
  size?: 'default' | 'comfortable';
}

export function SectionHeader({
  title,
  subtitle,
  accent = 'brand',
  className = '',
  size = 'default',
}: SectionHeaderProps) {
  const titleClass = size === 'comfortable' ? 'text-base font-semibold' : 'text-sm font-semibold';
  const subClass =
    size === 'comfortable'
      ? 'text-sm text-dark-textSecondary mt-1 leading-relaxed'
      : 'text-xs text-dark-textSecondary mt-0.5 leading-relaxed';

  return (
    <div
      className={`border-l-4 pl-3 mb-3 ${HW_ACCENT_LEFT[accent]} ${className}`}
    >
      <h4 className={`${titleClass} ${HW_TEXT[accent]}`}>{title}</h4>
      {subtitle != null && <p className={subClass}>{subtitle}</p>}
    </div>
  );
}
