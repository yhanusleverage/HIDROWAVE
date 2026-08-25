'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  toBcp47,
  type AppLocale,
} from '@/lib/locale';
import { loadSettings, persistLanguage, readStoredLocale } from '@/lib/settings';
import { getAppTranslations, type AppTranslations } from '@/lib/translations/app';

interface LanguageContextValue {
  locale: AppLocale;
  t: AppTranslations;
  refreshLocale: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { userProfile } = useAuth();
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE);

  const refreshLocale = useCallback(async () => {
    const settings = await loadSettings(userProfile?.email);
    setLocale(normalizeLocale(settings.language));
  }, [userProfile?.email]);

  useEffect(() => {
    setLocale(readStoredLocale());
    void refreshLocale();
  }, [refreshLocale]);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ language?: string }>).detail;
      if (detail?.language) {
        const next = normalizeLocale(detail.language);
        persistLanguage(next);
        setLocale(next);
      } else {
        void refreshLocale();
      }
    };
    window.addEventListener('settingsUpdated', onSettingsUpdated);
    return () => window.removeEventListener('settingsUpdated', onSettingsUpdated);
  }, [refreshLocale]);

  useEffect(() => {
    document.documentElement.lang = toBcp47(locale);
  }, [locale]);

  const t = useMemo(() => getAppTranslations(locale), [locale]);

  return (
    <LanguageContext.Provider value={{ locale, t, refreshLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage deve ser usado dentro de LanguageProvider');
  }
  return ctx;
}
