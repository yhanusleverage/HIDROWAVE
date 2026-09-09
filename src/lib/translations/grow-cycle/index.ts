import { normalizeLocale } from '@/lib/locale';
import type { GrowCycleChromeTranslations } from './types';
import { growCycleChromePt } from './pt-BR';
import { growCycleChromeEn } from './en';
import { growCycleChromeEs } from './es';

export function getGrowCycleChrome(language: string): GrowCycleChromeTranslations {
  const locale = normalizeLocale(language);
  if (locale === 'en') return growCycleChromeEn;
  if (locale === 'es') return growCycleChromeEs;
  return growCycleChromePt;
}

export function getPhaseLabels(
  language: string
): GrowCycleChromeTranslations['phaseLabels'] {
  return getGrowCycleChrome(language).phaseLabels;
}

export type { GrowCycleChromeTranslations };
export { growCycleChromePt, growCycleChromeEn, growCycleChromeEs };
