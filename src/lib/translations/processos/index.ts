import { normalizeLocale } from '@/lib/locale';
import type { ProcessosPageSlug } from '../docs/types';
import type { DocsPageContent, DocsNavTree } from '../docs/types';
import { processosNavPt, processosPagesPt } from './pt-BR';
import { processosNavEn, processosPagesEn } from './en';
import { processosNavEs, processosPagesEs } from './es';

export function getProcessosNav(language: string): DocsNavTree {
  const locale = normalizeLocale(language);
  if (locale === 'en') return processosNavEn;
  if (locale === 'es') return processosNavEs;
  return processosNavPt;
}

export function getProcessosPage(slug: ProcessosPageSlug, language: string): DocsPageContent {
  const locale = normalizeLocale(language);
  const pages =
    locale === 'en' ? processosPagesEn : locale === 'es' ? processosPagesEs : processosPagesPt;
  return pages[slug];
}

export type { ProcessosPageSlug };
