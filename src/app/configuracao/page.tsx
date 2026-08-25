'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NavLink from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import { loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { LOCALE_OPTIONS, normalizeLocale } from '@/lib/locale';
import {
  Cog6ToothIcon,
  KeyIcon,
  ServerIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function ConfiguracaoPage() {
  const router = useRouter();
  const { signOut, userProfile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialSettingsRef = useRef<Settings | null>(null);

  const getDefaultTimezone = (): string => {
    if (typeof window !== 'undefined' && Intl?.DateTimeFormat) {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // fallback
      }
    }
    return 'America/Sao_Paulo';
  };

  const [settings, setSettings] = useState<Settings>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    pollingInterval: 30,
    notifications: true,
    emailAlerts: false,
    soundAlerts: true,
    language: 'pt-BR',
    theme: 'dark',
    timezone: getDefaultTimezone(),
    ecThresholds: {
      dangerMin: 250,
      dangerMax: 750,
      warningMin: 400,
      warningMax: 600,
    },
  });

  useEffect(() => {
    const loadConfig = async () => {
      const loaded = await loadSettings(userProfile?.email);
      setSettings(loaded);
      initialSettingsRef.current = { ...loaded };
    };
    void loadConfig();
  }, [userProfile?.email]);

  useEffect(() => {
    if (initialSettingsRef.current) {
      const changed = JSON.stringify(settings) !== JSON.stringify(initialSettingsRef.current);
      setHasChanges(changed);
    }
  }, [settings]);

  const handleSave = async () => {
    if (settings.pollingInterval < 5 || settings.pollingInterval > 300) {
      toast.error(t.config.pollingRangeError);
      return;
    }

    if (settings.supabaseUrl && !settings.supabaseUrl.startsWith('http')) {
      toast.error(t.config.urlError);
      return;
    }

    setSaving(true);
    try {
      const normalized = { ...settings, language: normalizeLocale(settings.language) };
      const success = await saveSettings(normalized, userProfile?.email);
      if (success) {
        setSettings(normalized);
        initialSettingsRef.current = { ...normalized };
        setHasChanges(false);
        toast.success(t.config.saveSuccess);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: normalized }));
        }
      } else {
        toast.error(t.config.saveError);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error(t.config.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm(t.config.discardConfirm)) {
        if (initialSettingsRef.current) {
          const restored = { ...initialSettingsRef.current };
          setSettings(restored);
          setHasChanges(false);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('settingsUpdated', { detail: { language: restored.language } })
            );
          }
          toast(t.config.discarded, { icon: 'ℹ️' });
        }
      }
    }
  };

  const handleChange = (key: keyof Settings, value: string | number | boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleReset = async () => {
    if (confirm(t.config.resetConfirm)) {
      const defaultSettings = await loadSettings(userProfile?.email);
      setSettings(defaultSettings);
      toast(t.config.resetDone, { icon: 'ℹ️' });
    }
  };

  const handleLogout = async () => {
    if (!confirm(t.config.logoutConfirm)) {
      return;
    }

    setLoading(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error(t.config.logoutError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
            ⚙️ {t.config.title}
          </h1>
          <p className="text-dark-textSecondary mt-1">{t.config.subtitle}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <ServerIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">{t.config.dbTitle}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="supabaseUrl" className="block text-sm font-medium text-dark-textSecondary mb-1">
                {t.config.supabaseUrl}
              </label>
              <input
                id="supabaseUrl"
                type="text"
                value={settings.supabaseUrl}
                onChange={(e) => handleChange('supabaseUrl', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                placeholder="https://seu-projeto.supabase.co"
              />
            </div>

            <div>
              <label htmlFor="supabaseKey" className="block text-sm font-medium text-dark-textSecondary mb-1">
                {t.config.supabaseKey}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="supabaseKey"
                  type="password"
                  value={settings.supabaseKey}
                  onChange={(e) => handleChange('supabaseKey', e.target.value)}
                  className="flex-1 p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
                <KeyIcon className="w-5 h-5 text-dark-textSecondary" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Cog6ToothIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">{t.config.generalTitle}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="pollingInterval" className="block text-sm font-medium text-dark-textSecondary mb-1">
                {t.config.pollingInterval}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="pollingInterval"
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={settings.pollingInterval}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 30;
                    handleChange('pollingInterval', Math.max(5, Math.min(300, value)));
                  }}
                  className="flex-1 p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
                />
                <span className="text-xs text-dark-textSecondary whitespace-nowrap">
                  ({settings.pollingInterval}s = {Math.round((settings.pollingInterval / 60) * 10) / 10}min)
                </span>
              </div>
              <p className="text-xs text-dark-textSecondary mt-1">💡 {t.config.pollingHint}</p>
            </div>

            <div>
              <label htmlFor="language" className="block text-sm font-medium text-dark-textSecondary mb-1">
                {t.config.language}
              </label>
              <select
                id="language"
                value={normalizeLocale(settings.language)}
                onChange={(e) => {
                  const language = e.target.value;
                  handleChange('language', language);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('settingsUpdated', { detail: { language } })
                    );
                  }
                }}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-textSecondary mt-1">{t.config.languageHint}</p>
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-dark-textSecondary mb-1">
                {t.config.theme}
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <option value="light">{t.config.themeLight}</option>
                <option value="dark">{t.config.themeDark}</option>
                <option value="auto">{t.config.themeAuto}</option>
              </select>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-dark-textSecondary mb-1">
                🌍 {t.config.timezone}
              </label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <optgroup label={t.config.americas}>
                  <option value="America/Sao_Paulo">Brasil (São Paulo) - UTC-3</option>
                  <option value="America/Manaus">Brasil (Manaus) - UTC-4</option>
                  <option value="America/New_York">EUA (Nova York) - UTC-5</option>
                  <option value="America/Los_Angeles">EUA (Los Angeles) - UTC-8</option>
                  <option value="America/Mexico_City">México (Cidade do México) - UTC-6</option>
                  <option value="America/Buenos_Aires">Argentina (Buenos Aires) - UTC-3</option>
                </optgroup>
                <optgroup label={t.config.europe}>
                  <option value="Europe/London">Reino Unido (Londres) - UTC+0</option>
                  <option value="Europe/Paris">França (Paris) - UTC+1</option>
                  <option value="Europe/Madrid">Espanha (Madrid) - UTC+1</option>
                  <option value="Europe/Berlin">Alemanha (Berlim) - UTC+1</option>
                </optgroup>
                <optgroup label={t.config.asia}>
                  <option value="Asia/Tokyo">Japão (Tóquio) - UTC+9</option>
                  <option value="Asia/Shanghai">China (Xangai) - UTC+8</option>
                  <option value="Asia/Dubai">Emirados Árabes (Dubai) - UTC+4</option>
                </optgroup>
              </select>
              <p className="text-xs text-dark-textSecondary mt-1">💡 {t.config.timezoneHint}</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <BellIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">{t.config.notificationsTitle}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark-text">{t.config.notificationsOn}</p>
                <p className="text-xs text-dark-textSecondary">{t.config.notificationsOnDesc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => handleChange('notifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-surface border border-dark-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aqua-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-aqua-500 peer-checked:to-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark-text">{t.config.emailAlerts}</p>
                <p className="text-xs text-dark-textSecondary">{t.config.emailAlertsDesc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => handleChange('emailAlerts', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-surface border border-dark-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aqua-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-aqua-500 peer-checked:to-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark-text">{t.config.soundAlerts}</p>
                <p className="text-xs text-dark-textSecondary">{t.config.soundAlertsDesc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundAlerts}
                  onChange={(e) => handleChange('soundAlerts', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-surface border border-dark-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-aqua-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-aqua-500 peer-checked:to-primary-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <span>⚠️</span>
                <span>{t.config.unsaved}</span>
              </span>
            )}
            {!hasChanges && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                <span>{t.config.allSaved}</span>
              </span>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-textSecondary border border-dark-border rounded-lg font-medium transition-colors text-sm"
            >
              {t.config.restoreDefault}
            </button>
            <button
              onClick={handleCancel}
              disabled={!hasChanges}
              className="px-6 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.config.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-aqua-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t.config.saving}</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>{t.config.saveButton}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-dark-card border border-red-500/30 rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <ArrowRightOnRectangleIcon className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-semibold text-dark-text">{t.config.sessionTitle}</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <p className="text-sm text-dark-textSecondary mb-2">
                <span className="font-medium text-dark-text">{t.config.user}:</span>{' '}
                {userProfile?.email || t.config.notIdentified}
              </p>
              {userProfile?.name && (
                <p className="text-sm text-dark-textSecondary mb-2">
                  <span className="font-medium text-dark-text">{t.config.name}:</span> {userProfile.name}
                </p>
              )}
              <p className="text-sm text-dark-textSecondary">
                <span className="font-medium text-dark-text">{t.config.plan}:</span>{' '}
                <span className="capitalize">{userProfile?.subscription_type || 'N/A'}</span>
                {' · '}
                <NavLink href="/planos" className="text-aqua-400 hover:text-aqua-300 transition-colors">
                  {t.config.managePlan}
                </NavLink>
              </p>
            </div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span>{loading ? t.config.loggingOut : t.config.logout}</span>
            </button>
            <p className="text-xs text-dark-textSecondary text-center">{t.config.logoutHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
