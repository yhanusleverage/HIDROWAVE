'use client';

import React from 'react';
import NavLink from '@/components/NavLink';
import { QUEM_SOMOS_TEASER } from '@/lib/content/quem-somos';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function QuemSomosTeaser() {
  return (
    <div className="mb-6 bg-dark-card border border-dark-border border-l-4 border-l-aqua-500 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <SparklesIcon className="w-5 h-5 text-aqua-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-dark-text">{QUEM_SOMOS_TEASER.title}</p>
          <p className="text-xs text-dark-textSecondary mt-0.5 leading-relaxed">
            {QUEM_SOMOS_TEASER.subtitle}
          </p>
        </div>
      </div>
      <NavLink
        href="/quem-somos#elementos"
        className="inline-flex items-center gap-1 text-sm font-medium text-aqua-400 hover:text-aqua-300 shrink-0"
      >
        {QUEM_SOMOS_TEASER.cta}
        <ArrowRightIcon className="w-4 h-4" />
      </NavLink>
    </div>
  );
}
