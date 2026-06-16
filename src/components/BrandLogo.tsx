'use client';

import React from 'react';

export type BrandLogoVariant = 'dark' | 'gradient' | 'mono' | 'light';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: number;
  showWordmark?: boolean;
  wordmarkSize?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

const WORDMARK_SIZES = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
} as const;

function SigmaMark({
  variant,
  size,
  animate,
}: {
  variant: BrandLogoVariant;
  size: number;
  animate?: boolean;
}) {
  const gradientId = React.useId().replace(/:/g, '');

  const strokeColor =
    variant === 'mono'
      ? '#bae6fd'
      : variant === 'light'
        ? '#0284c7'
        : variant === 'dark'
          ? '#2dd4bf'
          : undefined;

  const showBackground = variant === 'dark';
  const monoOpacity = variant === 'mono' ? 0.6 : 1;

  return (
    <span
      className={`inline-flex origin-center ${animate ? 'animate-brand-breathe' : ''}`}
      style={animate ? { willChange: 'transform' } : undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
      >
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#26c6da" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      )}
      {showBackground && (
        <rect width="32" height="32" rx="7" fill="#0c1222" />
      )}
      <g transform="translate(4 4)" opacity={monoOpacity}>
        <path
          d="M18 7V4H6l6 8-6 8h12v-3"
          stroke={variant === 'gradient' ? `url(#${gradientId})` : strokeColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
    </span>
  );
}

export default function BrandLogo({
  variant = 'dark',
  size = 32,
  showWordmark = false,
  wordmarkSize = 'md',
  className = '',
  animate = false,
}: BrandLogoProps) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      aria-label="HydroWave"
      role="img"
    >
      <SigmaMark variant={variant} size={size} animate={animate} />
      {showWordmark && (
        <span className={`font-bold whitespace-nowrap ${WORDMARK_SIZES[wordmarkSize]}`}>
          <span className={variant === 'light' ? 'text-slate-800' : 'text-dark-text'}>
            Hydro
          </span>
          <span
            className={
              variant === 'light'
                ? 'text-primary-500'
                : 'bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent'
            }
          >
            Wave
          </span>
        </span>
      )}
    </div>
  );
}

export function BrandMarkIcon({ size = 16 }: { size?: number }) {
  return <SigmaMark variant="gradient" size={size} />;
}
