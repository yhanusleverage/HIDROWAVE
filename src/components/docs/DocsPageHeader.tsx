'use client';

import React from 'react';
import BrandLogo from '@/components/BrandLogo';
import NavLink from '@/components/NavLink';

interface DocsPageHeaderProps {
  title: string;
  subtitle: string;
  breadcrumb: string;
  sectionHref: string;
  sectionLabel: string;
}

export function DocsPageHeader({
  title,
  subtitle,
  breadcrumb,
  sectionHref,
  sectionLabel,
}: DocsPageHeaderProps) {
  return (
    <header className="bg-dark-card border-b border-dark-border shadow-lg mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto">
        <nav className="text-xs text-dark-textSecondary mb-3">
          <NavLink href={sectionHref} className="hover:text-aqua-400 transition-colors">
            {sectionLabel}
          </NavLink>
          <span className="mx-2">/</span>
          <span className="text-dark-text">{breadcrumb}</span>
        </nav>
        <div className="flex items-center gap-4">
          <BrandLogo variant="gradient" size={36} />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-dark-textSecondary mt-1 text-sm">{subtitle}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
