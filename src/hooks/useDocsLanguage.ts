'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { loadSettings } from '@/lib/settings';
import { normalizeLocale, type AppLocale } from '@/lib/locale';

export function useDocsLanguage(): { language: AppLocale; loading: boolean } {
  const { userProfile } = useAuth();
  const [language, setLanguage] = useState<AppLocale>('pt-BR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      if (userProfile?.email) {
        try {
          const settings = await loadSettings(userProfile.email);
          setLanguage(normalizeLocale(settings.language));
        } catch {
          setLanguage('pt-BR');
        }
      } else if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('hydrowave_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            setLanguage(normalizeLocale(parsed.language));
          }
        } catch {
          setLanguage('pt-BR');
        }
      }
      setLoading(false);
    };
    loadLanguage();

    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ language?: string }>).detail;
      if (detail?.language) {
        setLanguage(normalizeLocale(detail.language));
      }
    };
    window.addEventListener('settingsUpdated', onSettingsUpdated);
    return () => window.removeEventListener('settingsUpdated', onSettingsUpdated);
  }, [userProfile?.email]);

  return { language, loading };
}
