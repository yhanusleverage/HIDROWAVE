import type { SupportPageSlug } from '../docs/types';
import type { DocsPageContent, DocsNavTree } from '../docs/types';
import { supportNavPt, supportPagesPt } from './pt-BR';
import { supportNavEn, supportPagesEn } from './en';
import { supportNavEs, supportPagesEs } from './es';

export function getSupportNav(language: string): DocsNavTree {
  if (language === 'en') return supportNavEn;
  if (language === 'es') return supportNavEs;
  return supportNavPt;
}

export function getSupportPage(slug: SupportPageSlug, language: string): DocsPageContent {
  const pages =
    language === 'en' ? supportPagesEn : language === 'es' ? supportPagesEs : supportPagesPt;
  return pages[slug];
}

export type { SupportPageSlug };
