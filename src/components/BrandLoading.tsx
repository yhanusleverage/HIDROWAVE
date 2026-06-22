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
  const logoSize = size ?? (layout === 'hero' ? 72 : layout === 'fullscreen' ? 64 : 48);

  const wrapperClass =
    layout === 'fullscreen'
      ? 'min-h-screen w-full flex flex-col items-center justify-center bg-dark-bg'
      : layout === 'fill' || layout === 'hero'
        ? 'min-h-[calc(100vh-4rem)] w-full flex flex-col items-center justify-center'
        : `text-center py-8 ${className}`;

  if (layout === 'hero') {
    return (
      <div
        className={`flex flex-col items-center justify-center w-full ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="relative flex flex-col items-center justify-center">
          <div
            className="absolute h-36 w-36 rounded-full bg-gradient-to-br from-aqua-500/10 to-primary-500/5 animate-brand-breathe"
            aria-hidden="true"
          />
          <div
            className="absolute h-28 w-28 rounded-full border border-aqua-400/20 animate-brand-breathe"
            style={{ animationDelay: '0.35s' }}
            aria-hidden="true"
          />
          <div
            className="absolute h-20 w-20 rounded-full border border-primary-400/30 animate-brand-breathe"
            style={{ animationDelay: '0.7s' }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <BrandLogo variant={variant} size={logoSize} animate className="justify-center" />
            {showWordmark && (
              <span className="text-2xl font-bold tracking-tight">
                <span className="text-dark-text">Hydro</span>
                <span className="bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                  Wave
                </span>
              </span>
            )}
          </div>
        </div>
        {message && (
          <p className="mt-8 text-sm text-dark-textSecondary/90 tracking-wide animate-pulse">
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
