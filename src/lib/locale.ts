/**
 * Locale unificado da aplicação (UI + docs).
 * Valores canónicos: pt-BR | en | es
 */

export type AppLocale = 'pt-BR' | 'en' | 'es';

export const DEFAULT_LOCALE: AppLocale = 'pt-BR';

export const LOCALE_OPTIONS: { value: AppLocale; label: string }[] = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

/** Normaliza códigos legados (en-US, es-ES) para o formato da app. */
export function normalizeLocale(raw: string | undefined | null): AppLocale {
  if (!raw) return DEFAULT_LOCALE;
  const lower = raw.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('es')) return 'es';
  return 'pt-BR';
}

/** Chave usada em fundamentos.ts (en-US / es-ES). */
export function toFundamentosKey(locale: AppLocale): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'es') return 'es-ES';
  return 'pt-BR';
}

/** Atributo html lang e toLocaleString. */
export function toBcp47(locale: AppLocale): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'es') return 'es-ES';
  return 'pt-BR';
}
