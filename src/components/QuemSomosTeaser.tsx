'use client';

import React, { useMemo } from 'react';
import NavLink from '@/components/NavLink';
import { useLanguage } from '@/contexts/LanguageContext';
import { getQuemSomosContent } from '@/lib/translations/quem-somos';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function QuemSomosTeaser() {
  const { locale } = useLanguage();
  const teaser = useMemo(() => getQuemSomosContent(locale).teaser, [locale]);

  return (
    <div className="mb-6 bg-dark-card border border-dark-border border-l-4 border-l-aqua-500 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <SparklesIcon className="w-5 h-5 text-aqua-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-dark-text">{teaser.title}</p>
          <p className="text-xs text-dark-textSecondary mt-0.5 leading-relaxed">{teaser.subtitle}</p>
        </div>
      </div>
      <NavLink
        href="/quem-somos#linha-produto"
        className="inline-flex items-center gap-1 text-sm font-medium text-aqua-400 hover:text-aqua-300 shrink-0"
      >
        {teaser.cta}
        <ArrowRightIcon className="w-4 h-4" />
      </NavLink>
    </div>
  );
}
