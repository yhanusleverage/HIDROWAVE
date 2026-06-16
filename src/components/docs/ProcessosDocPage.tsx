'use client';

import React from 'react';
import { DocsPageClient } from '@/components/docs/DocsPageClient';
import { useDocsLanguage } from '@/hooks/useDocsLanguage';
import { getProcessosNav, getProcessosPage, type ProcessosPageSlug } from '@/lib/translations/processos';

const SECTION_LABELS: Record<string, Record<string, string>> = {
  'pt-BR': { processos: 'Processos' },
  en: { processos: 'Processes' },
  es: { processos: 'Procesos' },
};

interface ProcessosDocPageProps {
  slug: ProcessosPageSlug;
}

export function ProcessosDocPage({ slug }: ProcessosDocPageProps) {
  const { language } = useDocsLanguage();

  const page = getProcessosPage(slug, language);
  const nav = getProcessosNav(language);
  const sectionLabel = SECTION_LABELS[language]?.processos ?? 'Processos';

  return (
    <DocsPageClient
      page={page}
      nav={nav}
      sectionHref="/processos"
      sectionLabel={sectionLabel}
    />
  );
}
