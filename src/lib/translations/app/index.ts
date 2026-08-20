import type { AppLocale } from '@/lib/locale';
import { normalizeLocale } from '@/lib/locale';
import { appPtBR } from './pt-BR';
import { appEn } from './en';
import { appEs } from './es';
import type { AppTranslations } from './types';

const byLocale: Record<AppLocale, AppTranslations> = {
  'pt-BR': appPtBR,
  en: appEn,
  es: appEs,
};

export function getAppTranslations(language: string | undefined): AppTranslations {
  const locale = normalizeLocale(language);
  return byLocale[locale];
}

export type { AppTranslations };
