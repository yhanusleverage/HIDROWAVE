'use client';

import React from 'react';

export type HwButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type HwButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<HwButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white border-transparent',
  secondary:
    'bg-dark-card border-dark-border text-dark-text hover:bg-dark-surface hover:border-aqua-500/40',
  ghost:
    'bg-transparent border-transparent text-dark-textSecondary hover:bg-dark-card/80 hover:text-dark-text',
  danger:
    'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25',
};

const SIZE_CLASSES: Record<HwButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export interface HwButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: HwButtonVariant;
  size?: HwButtonSize;
  fullWidth?: boolean;
}

export function HwButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: HwButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
