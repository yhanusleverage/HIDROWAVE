'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NavLink from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { loadSettings, saveSettings, type Settings } from '@/lib/settings';
import {
  Cog6ToothIcon,
  KeyIcon,
  ServerIcon,
  BellIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

export default function ConfiguracaoPage() {
  const router = useRouter();
  const { signOut, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialSettingsRef = useRef<Settings | null>(null);
  
  // ✅ Detectar timezone do navegador do usuário ou usar padrão
  const getDefaultTimezone = (): string => {
    if (typeof window !== 'undefined' && Intl?.DateTimeFormat) {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (e) {
        // Fallback se não conseguir detectar
      }
    }
    return 'America/Sao_Paulo'; // Fallback padrão
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
    timezone: getDefaultTimezone(), // ✅ Timezone do navegador do usuário
    // ✅ Umbrales padrão de EC
    ecThresholds: {
      dangerMin: 250,
      dangerMax: 750,
      warningMin: 400,
      warningMax: 600,
    },
  });

  // Carregar configurações do Supabase ao montar
  useEffect(() => {
    const loadConfig = async () => {
      if (userProfile?.email) {
        const loaded = await loadSettings(userProfile.email);
        setSettings(loaded);
        initialSettingsRef.current = { ...loaded };
      } else {
        // Fallback: localStorage
        const loaded = await loadSettings();
        setSettings(loaded);
        initialSettingsRef.current = { ...loaded };
      }
    };
    loadConfig();
  }, [userProfile?.email]);

  // Verificar mudanças
  useEffect(() => {
    if (initialSettingsRef.current) {
      const changed = JSON.stringify(settings) !== JSON.stringify(initialSettingsRef.current);
      setHasChanges(changed);
    }
  }, [settings]);

  const handleSave = async () => {
    // Validações
    if (settings.pollingInterval < 5 || settings.pollingInterval > 300) {
      toast.error('Intervalo de atualização deve estar entre 5 e 300 segundos');
      return;
    }

    if (settings.supabaseUrl && !settings.supabaseUrl.startsWith('http')) {
      toast.error('URL do Supabase deve começar com http:// ou https://');
      return;
    }

    setSaving(true);
    try {
      const success = await saveSettings(settings, userProfile?.email);
      if (success) {
        initialSettingsRef.current = { ...settings };
        setHasChanges(false);
        toast.success('Configurações salvas com sucesso no Supabase!');
        
        // Notificar outras páginas sobre mudanças
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
        }
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('Você tem alterações não salvas. Deseja descartá-las?')) {
        if (initialSettingsRef.current) {
          setSettings({ ...initialSettingsRef.current });
          setHasChanges(false);
          toast('Alterações descartadas', { icon: 'ℹ️' });
        }
      }
    }
  };

  const handleChange = (key: keyof Settings, value: string | number | boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleReset = async () => {
    if (confirm('Deseja restaurar as configurações padrão? Todas as alterações serão perdidas.')) {
      const defaultSettings = await loadSettings(userProfile?.email);
      setSettings(defaultSettings);
      toast('Configurações restauradas para o padrão', { icon: 'ℹ️' });
    }
  };

  const handleLogout = async () => {
    if (!confirm('Tem certeza que deseja fazer logout?')) {
      return;
    }

    setLoading(true);
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">⚙️ Configuração</h1>
          <p className="text-dark-textSecondary mt-1">Configure as preferências do sistema</p>
        </div>
      </header>
      
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Conexão com Supabase */}
        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <ServerIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Conexão com Banco de Dados</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="supabaseUrl" className="block text-sm font-medium text-dark-textSecondary mb-1">
                URL do Supabase
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
                Chave Anônima do Supabase
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

        {/* Configurações Gerais */}
        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Cog6ToothIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Configurações Gerais</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="pollingInterval" className="block text-sm font-medium text-dark-textSecondary mb-1">
                Intervalo de Atualização (segundos)
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
                  ({settings.pollingInterval}s = {Math.round(settings.pollingInterval / 60 * 10) / 10}min)
                </span>
              </div>
              <p className="text-xs text-dark-textSecondary mt-1">
                💡 Recomendado: 30 segundos. Mínimo: 5s, Máximo: 300s (5 minutos)
              </p>
            </div>
            
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-dark-textSecondary mb-1">
                Idioma
              </label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-dark-textSecondary mb-1">
                Tema
              </label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
                <option value="auto">Automático</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-dark-textSecondary mb-1">
                🌍 Fuso Horário (Timezone)
              </label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="w-full p-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:ring-2 focus:ring-aqua-500 focus:border-aqua-500 focus:outline-none"
              >
                <optgroup label="Américas">
                  <option value="America/Sao_Paulo">Brasil (São Paulo) - UTC-3</option>
                  <option value="America/Manaus">Brasil (Manaus) - UTC-4</option>
                  <option value="America/New_York">EUA (Nova York) - UTC-5</option>
                  <option value="America/Los_Angeles">EUA (Los Angeles) - UTC-8</option>
                  <option value="America/Mexico_City">México (Cidade do México) - UTC-6</option>
                  <option value="America/Buenos_Aires">Argentina (Buenos Aires) - UTC-3</option>
                </optgroup>
                <optgroup label="Europa">
                  <option value="Europe/London">Reino Unido (Londres) - UTC+0</option>
                  <option value="Europe/Paris">França (Paris) - UTC+1</option>
                  <option value="Europe/Madrid">Espanha (Madrid) - UTC+1</option>
                  <option value="Europe/Berlin">Alemanha (Berlim) - UTC+1</option>
                </optgroup>
                <optgroup label="Ásia">
                  <option value="Asia/Tokyo">Japão (Tóquio) - UTC+9</option>
                  <option value="Asia/Shanghai">China (Xangai) - UTC+8</option>
                  <option value="Asia/Dubai">Emirados Árabes (Dubai) - UTC+4</option>
                </optgroup>
              </select>
              <p className="text-xs text-dark-textSecondary mt-1">
                💡 Usado para ciclos circadianos e agendamentos. Será aplicado nas regras de automação.
              </p>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <BellIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">Notificações</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark-text">Notificações Ativadas</p>
                <p className="text-xs text-dark-textSecondary">Receba alertas sobre o status do sistema</p>
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
                <p className="text-sm font-medium text-dark-text">Alertas por Email</p>
                <p className="text-xs text-dark-textSecondary">Receba alertas críticos por email</p>
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
                <p className="text-sm font-medium text-dark-text">Alertas Sonoros</p>
                <p className="text-xs text-dark-textSecondary">Reproduzir som quando houver alertas</p>
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

        {/* Botão Salvar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <span>⚠️</span>
                <span>Você tem alterações não salvas</span>
              </span>
            )}
            {!hasChanges && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Tudo salvo</span>
              </span>
            )}
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-border text-dark-textSecondary border border-dark-border rounded-lg font-medium transition-colors text-sm"
            >
              Restaurar Padrão
            </button>
            <button
              onClick={handleCancel}
              disabled={!hasChanges}
              className="px-6 py-2 bg-dark-surface hover:bg-dark-border text-dark-text border border-dark-border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-aqua-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Seção de Logout */}
        <div className="bg-dark-card border border-red-500/30 rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <ArrowRightOnRectangleIcon className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-semibold text-dark-text">Sessão do Usuário</h2>
          </div>
          
          <div className="space-y-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <p className="text-sm text-dark-textSecondary mb-2">
                <span className="font-medium text-dark-text">Usuário:</span>{' '}
                {userProfile?.email || 'Não identificado'}
              </p>
              {userProfile?.name && (
                <p className="text-sm text-dark-textSecondary mb-2">
                  <span className="font-medium text-dark-text">Nome:</span> {userProfile.name}
                </p>
              )}
              <p className="text-sm text-dark-textSecondary">
                <span className="font-medium text-dark-text">Plano:</span>{' '}
                <span className="capitalize">{userProfile?.subscription_type || 'N/A'}</span>
                {' · '}
                <NavLink href="/planos" className="text-aqua-400 hover:text-aqua-300 transition-colors">
                  Gerenciar plano →
                </NavLink>
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span>{loading ? 'Saindo...' : 'Fazer Logout'}</span>
            </button>
            <p className="text-xs text-dark-textSecondary text-center">
              Ao fazer logout, você será redirecionado para a página de login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

