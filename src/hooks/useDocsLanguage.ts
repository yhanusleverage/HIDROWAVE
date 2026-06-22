'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { loadSettings } from '@/lib/settings';

export function useDocsLanguage(): { language: string; loading: boolean } {
  const { userProfile } = useAuth();
  const [language, setLanguage] = useState('pt-BR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      if (userProfile?.email) {
        try {
          const settings = await loadSettings(userProfile.email);
          setLanguage(settings.language || 'pt-BR');
        } catch {
          setLanguage('pt-BR');
        }
      } else if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('hydrowave_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            setLanguage(parsed.language || 'pt-BR');
          }
        } catch {
          setLanguage('pt-BR');
        }
      }
      setLoading(false);
    };
    loadLanguage();
  }, [userProfile?.email]);

  return { language, loading };
}
