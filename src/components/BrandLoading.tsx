'use client';

import React from 'react';
import BrandLogo, { type BrandLogoVariant } from '@/components/BrandLogo';

type BrandLoadingLayout = 'inline' | 'fill' | 'fullscreen' | 'hero';

interface BrandLoadingProps {
  message?: string;
  size?: number;
  variant?: BrandLogoVariant;
  layout?: BrandLoadingLayout;
  showWordmark?: boolean;
  className?: string;
}

export default function BrandLoading({
  message,
  size,
  variant = 'gradient',
  layout = 'inline',
  showWordmark = false,
  className = '',
}: BrandLoadingProps) {
  const logoSize =
    size ?? (layout === 'hero' ? 120 : layout === 'fullscreen' ? 96 : 48);

  const wrapperClass =
    layout === 'fullscreen'
      ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-bg'
      : layout === 'fill'
        ? 'min-h-[calc(100dvh-4rem)] w-full flex flex-col items-center justify-center'
        : `text-center py-8 ${className}`;

  if (layout === 'hero') {
    const ring = Math.round(logoSize * 2.2);
    const ringMid = Math.round(logoSize * 1.7);
    const ringIn = Math.round(logoSize * 1.25);

    return (
      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-bg ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="relative flex flex-col items-center justify-center"
          style={{ width: ring, height: ring }}
        >
          <div
            className="absolute rounded-full bg-gradient-to-br from-aqua-500/10 to-primary-500/5 animate-brand-breathe"
            style={{ width: ring, height: ring }}
            aria-hidden="true"
          />
          <div
            className="absolute rounded-full border border-aqua-400/20 animate-brand-breathe"
            style={{ width: ringMid, height: ringMid, animationDelay: '0.35s' }}
            aria-hidden="true"
          />
          <div
            className="absolute rounded-full border border-primary-400/30 animate-brand-breathe"
            style={{ width: ringIn, height: ringIn, animationDelay: '0.7s' }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <BrandLogo variant={variant} size={logoSize} animate className="justify-center" />
            {showWordmark && (
              <span className="text-4xl sm:text-5xl font-bold tracking-tight">
                <span className="text-dark-text">Hydro</span>
                <span className="bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                  Wave
                </span>
              </span>
            )}
          </div>
        </div>
        {message && (
          <p className="mt-10 text-base sm:text-lg text-dark-textSecondary/90 tracking-wide animate-pulse">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClass} role="status" aria-live="polite" aria-busy="true">
      <BrandLogo variant={variant} size={logoSize} animate className="justify-center mb-4" />
      {showWordmark && (
        <p className="mb-4 text-lg font-semibold">
          <span className="text-dark-text">Hydro</span>
          <span className="bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
            Wave
          </span>
        </p>
      )}
      {message && <p className="text-sm text-dark-textSecondary">{message}</p>}
    </div>
  );
}
