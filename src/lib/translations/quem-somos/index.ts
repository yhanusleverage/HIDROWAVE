import { normalizeLocale } from '@/lib/locale';
import type { QuemSomosCopy } from './types';
import { quemSomosPt } from './pt-BR';
import { quemSomosEn } from './en';
import { quemSomosEs } from './es';

export function getQuemSomosContent(language: string): QuemSomosCopy {
  const locale = normalizeLocale(language);
  if (locale === 'en') return quemSomosEn;
  if (locale === 'es') return quemSomosEs;
  return quemSomosPt;
}

export type {
  QuemSomosCopy,
  QuemSomosIconId,
  QuemSomosElement,
  QuemSomosJourneyStep,
  QuemSomosSocialProof,
  QuemSomosBeforeAfterRow,
} from './types';
