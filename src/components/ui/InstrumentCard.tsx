'use client';

import React from 'react';
import { HW_ACCENT_TOP, HW_BG_SUBTLE, type HwAccent } from '@/lib/design-tokens';

export interface InstrumentCardProps {
  accent?: HwAccent;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Fundo sutil do domínio (ex.: bloco de equação). */
  tinted?: boolean;
  ariaLive?: 'polite' | 'assertive' | 'off';
}

export function InstrumentCard({
  accent = 'neutral',
  title,
  children,
  className = '',
  tinted = false,
  ariaLive,
}: InstrumentCardProps) {
  const surface = tinted ? HW_BG_SUBTLE[accent] : 'bg-dark-surface border-dark-border';

  return (
    <div
      className={`rounded-lg border border-t-2 p-4 ${HW_ACCENT_TOP[accent]} ${surface} ${className}`}
      aria-live={ariaLive}
    >
      {title != null && (
        <h3 className="text-base font-semibold text-dark-text mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}
