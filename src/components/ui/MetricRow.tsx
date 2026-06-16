'use client';

import React from 'react';
import { HW_METRIC_VALUE, type HwMetricVariant } from '@/lib/design-tokens';

export interface MetricRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  variant?: HwMetricVariant;
  hint?: React.ReactNode;
  className?: string;
  /** EC preview usa emerald em vez de violet. */
  domain?: 'ph' | 'ec' | 'default';
}

export function MetricRow({
  label,
  value,
  variant = 'default',
  hint,
  className = '',
  domain = 'default',
}: MetricRowProps) {
  let valueClass = HW_METRIC_VALUE[variant];
  if (variant === 'preview' && domain === 'ec') {
    valueClass = 'text-emerald-400 font-medium tabular-nums';
  }
  if (variant === 'setpoint' && domain === 'ec') {
    valueClass = 'text-emerald-400 font-medium tabular-nums';
  }

  return (
    <div className={`flex justify-between gap-2 ${className}`}>
      <span className="text-base text-dark-textSecondary">{label}</span>
      <span className={`text-base text-right ${valueClass}`}>
        {value}
        {hint != null && (
          <span className="block text-xs text-dark-textSecondary font-sans text-right mt-0.5">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
