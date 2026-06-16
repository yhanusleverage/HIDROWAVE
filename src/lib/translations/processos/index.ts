import type { ProcessosPageSlug } from '../docs/types';
import type { DocsPageContent, DocsNavTree } from '../docs/types';
import { processosNavPt, processosPagesPt } from './pt-BR';
import { processosNavEn, processosPagesEn } from './en';
import { processosNavEs, processosPagesEs } from './es';

export function getProcessosNav(language: string): DocsNavTree {
  if (language === 'en') return processosNavEn;
  if (language === 'es') return processosNavEs;
  return processosNavPt;
}

export function getProcessosPage(slug: ProcessosPageSlug, language: string): DocsPageContent {
  const pages =
    language === 'en' ? processosPagesEn : language === 'es' ? processosPagesEs : processosPagesPt;
  return pages[slug];
}

export type { ProcessosPageSlug };
