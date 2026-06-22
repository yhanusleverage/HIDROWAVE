'use client';

import React from 'react';
import { DocsShell } from '@/components/docs/DocsShell';
import BrandLoading from '@/components/BrandLoading';
import { useDocsLanguage } from '@/hooks/useDocsLanguage';
import { getDocsShellLabels } from '@/lib/translations/docs/labels';
import type { DocsPageContent, DocsNavTree } from '@/lib/translations/docs/types';

interface DocsPageClientProps {
  page: DocsPageContent;
  nav: DocsNavTree;
  sectionHref: string;
  sectionLabel: string;
}

export function DocsPageClient({ page, nav, sectionHref, sectionLabel }: DocsPageClientProps) {
  const { language, loading } = useDocsLanguage();
  const labels = getDocsShellLabels(language);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  return (
    <DocsShell
      page={page}
      nav={nav}
      labels={labels}
      sectionHref={sectionHref}
      sectionLabel={sectionLabel}
    />
  );
}
