import { normalizeLocale } from '@/lib/locale';
import type { PlanosCopy } from './types';
import { planosPt } from './pt-BR';
import { planosEn } from './en';
import { planosEs } from './es';

export function getPlanosContent(language: string): PlanosCopy {
  const locale = normalizeLocale(language);
  if (locale === 'en') return planosEn;
  if (locale === 'es') return planosEs;
  return planosPt;
}

export type {
  PlanosCopy,
  PlanId,
  PlanosTier,
  PlanosAddon,
  PlanosAddonId,
  PlanosComparisonRow,
} from './types';
