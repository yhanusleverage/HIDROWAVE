'use client';

import React from 'react';
import { HW_LABEL } from '@/lib/design-tokens';

const FIELD_CLASSES =
  'w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-dark-text placeholder:text-dark-textSecondary/60 focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500/50 disabled:opacity-50';

export interface HwInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function HwInput({ label, hint, error, id, className = '', ...props }: HwInputProps) {
  const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className={`block ${HW_LABEL}`}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${FIELD_CLASSES} ${error ? 'border-red-500/50 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-dark-textSecondary">{hint}</p>}
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}

export interface HwSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function HwSelect({ label, hint, error, id, className = '', children, ...props }: HwSelectProps) {
  const selectId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className={`block ${HW_LABEL}`}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`${FIELD_CLASSES} ${error ? 'border-red-500/50 focus:ring-red-500' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-dark-textSecondary">{hint}</p>}
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
