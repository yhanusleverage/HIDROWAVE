'use client';

import React from 'react';
import { DocsPageClient } from '@/components/docs/DocsPageClient';
import { useDocsLanguage } from '@/hooks/useDocsLanguage';
import { getSupportNav, getSupportPage, type SupportPageSlug } from '@/lib/translations/support';

const SECTION_LABELS: Record<string, Record<string, string>> = {
  'pt-BR': { support: 'Support' },
  en: { support: 'Support' },
  es: { support: 'Support' },
};

interface SupportDocPageProps {
  slug: SupportPageSlug;
}

export function SupportDocPage({ slug }: SupportDocPageProps) {
  const { language } = useDocsLanguage();

  const page = getSupportPage(slug, language);
  const nav = getSupportNav(language);
  const sectionLabel = SECTION_LABELS[language]?.support ?? 'Support';

  return (
    <DocsPageClient
      page={page}
      nav={nav}
      sectionHref="/support"
      sectionLabel={sectionLabel}
    />
  );
}
