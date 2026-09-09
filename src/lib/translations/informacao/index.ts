import { normalizeLocale } from '@/lib/locale';
import type { InformacaoCopy } from './types';
import { informacaoPt } from './pt-BR';
import { informacaoEn } from './en';
import { informacaoEs } from './es';

export function getInformacaoContent(language: string): InformacaoCopy {
  const locale = normalizeLocale(language);
  if (locale === 'en') return informacaoEn;
  if (locale === 'es') return informacaoEs;
  return informacaoPt;
}

export type {
  InformacaoCopy,
  InformacaoFaqItem,
  InformacaoQuickLinkId,
  AutoEcFaqStep,
} from './types';
