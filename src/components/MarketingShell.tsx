'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import ControlToaster from '@/components/ControlToaster';

interface MarketingShellProps {
  children: React.ReactNode;
}

export default function MarketingShell({ children }: MarketingShellProps) {
  const { user, userProfile, loading } = useAuth();
  const isAuthenticated = Boolean(user && userProfile?.is_active);

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <ControlToaster />
      <header className="sticky top-0 z-40 bg-dark-card/95 backdrop-blur border-b border-dark-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link href={isAuthenticated ? '/dashboard' : '/'} className="shrink-0">
            <BrandLogo variant="gradient" size={32} showWordmark wordmarkSize="sm" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/planos"
              className="text-dark-textSecondary hover:text-aqua-400 transition-colors hidden sm:inline"
            >
              Planos
            </Link>
            {!loading && (
              <Link
                href={isAuthenticated ? '/dashboard' : '/login'}
                className="inline-flex items-center px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white shadow-lg hover:shadow-aqua-500/30 transition-all"
              >
                {isAuthenticated ? 'Dashboard' : 'Entrar'}
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
