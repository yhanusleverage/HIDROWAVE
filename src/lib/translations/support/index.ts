import { normalizeLocale } from '@/lib/locale';
import type { SupportPageSlug } from '../docs/types';
import type { DocsPageContent, DocsNavTree } from '../docs/types';
import { supportNavPt, supportPagesPt } from './pt-BR';
import { supportNavEn, supportPagesEn } from './en';
import { supportNavEs, supportPagesEs } from './es';

export function getSupportNav(language: string): DocsNavTree {
  const locale = normalizeLocale(language);
  if (locale === 'en') return supportNavEn;
  if (locale === 'es') return supportNavEs;
  return supportNavPt;
}

export function getSupportPage(slug: SupportPageSlug, language: string): DocsPageContent {
  const locale = normalizeLocale(language);
  const pages =
    locale === 'en' ? supportPagesEn : locale === 'es' ? supportPagesEs : supportPagesPt;
  return pages[slug];
}

export type { SupportPageSlug };
