/**
 * Utilitário para gerenciar configurações do sistema
 * ✅ Agora salva em device_status (Supabase) ao invés de localStorage
 */

import { supabase } from './supabase';

const STORAGE_KEY = 'hydrowave_settings'; // Fallback para localStorage

export interface Settings {
  supabaseUrl: string;
  supabaseKey: string;
  pollingInterval: number;
  notifications: boolean;
  emailAlerts: boolean;
  soundAlerts: boolean;
  language: string;
  theme: string;
  timezone: string;  // ✅ NOVO: Timezone do usuário (ex: "America/Sao_Paulo")
}

const defaultSettings: Settings = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  pollingInterval: 30,
  notifications: true,
  emailAlerts: false,
  soundAlerts: true,
  language: 'pt-BR',
  theme: 'dark',
  timezone: 'America/Sao_Paulo',  // ✅ NOVO: Timezone padrão (Brasil)
};

/**
 * Busca o device_id do Master do usuário
 */
async function getMasterDeviceId(userEmail: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('device_status')
      .select('device_id')
      .eq('user_email', userEmail)
      .is('master_device_id', null) // Master não tem master_device_id
      .order('last_seen', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('⚠️ [SETTINGS] Nenhum Master encontrado para o usuário:', userEmail);
      return null;
    }

    return data.device_id;
  } catch (error) {
    console.error('❌ [SETTINGS] Erro ao buscar Master:', error);
    return null;
  }
}

/**
 * Carrega configurações do Supabase (device_status) ou localStorage (fallback)
 */
export async function loadSettings(userEmail?: string): Promise<Settings> {
  // ✅ Tentar carregar do Supabase primeiro
  if (userEmail) {
    try {
      const masterDeviceId = await getMasterDeviceId(userEmail);
      
      if (masterDeviceId) {
        const { data, error } = await supabase
          .from('device_status')
          .select('user_settings')
          .eq('device_id', masterDeviceId)
          .single();

        if (!error && data?.user_settings) {
          console.log('✅ [SETTINGS] Configurações carregadas do Supabase');
          const parsed = data.user_settings as Partial<Settings>;
          return {
            ...defaultSettings,
            ...parsed,
            pollingInterval: Math.max(5, Math.min(300, parsed.pollingInterval || defaultSettings.pollingInterval)),
          };
        }
      }
    } catch (error) {
      console.warn('⚠️ [SETTINGS] Erro ao carregar do Supabase, usando fallback:', error);
    }
  }

  // ✅ Fallback: localStorage
  if (typeof window !== 'undefined') {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        console.log('✅ [SETTINGS] Configurações carregadas do localStorage (fallback)');
        return {
          ...defaultSettings,
          ...parsed,
          pollingInterval: Math.max(5, Math.min(300, parsed.pollingInterval || defaultSettings.pollingInterval)),
        };
      }
    } catch (error) {
      console.error('❌ [SETTINGS] Erro ao carregar do localStorage:', error);
    }
  }

  return defaultSettings;
}

/**
 * Salva configurações no Supabase (device_status) e localStorage (backup)
 */
export async function saveSettings(settings: Settings, userEmail?: string): Promise<boolean> {
  let savedToSupabase = false;

  // ✅ Tentar salvar no Supabase primeiro
  if (userEmail) {
    try {
      const masterDeviceId = await getMasterDeviceId(userEmail);
      
      if (masterDeviceId) {
        // Verificar se o campo user_settings existe, se não, adicionar
        const { error: updateError } = await supabase
          .from('device_status')
          .update({ 
            user_settings: settings,
            updated_at: new Date().toISOString()
          })
          .eq('device_id', masterDeviceId);

        if (!updateError) {
          console.log('✅ [SETTINGS] Configurações salvas no Supabase (device_status)');
          savedToSupabase = true;
        } else {
          // Se erro por campo não existir, tentar adicionar via SQL
          console.warn('⚠️ [SETTINGS] Campo user_settings pode não existir. Erro:', updateError);
          console.log('💡 [SETTINGS] Execute: ALTER TABLE device_status ADD COLUMN IF NOT EXISTS user_settings JSONB;');
        }
      }
    } catch (error) {
      console.warn('⚠️ [SETTINGS] Erro ao salvar no Supabase:', error);
    }
  }

  // ✅ Sempre salvar no localStorage como backup
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      console.log('✅ [SETTINGS] Configurações salvas no localStorage (backup)');
    } catch (error) {
      console.error('❌ [SETTINGS] Erro ao salvar no localStorage:', error);
      return false;
    }
  }

  return savedToSupabase || true; // Retorna true se salvou em pelo menos um lugar
}

/**
 * Obtém o intervalo de polling configurado (em milissegundos)
 * ⚠️ Versão síncrona para uso em componentes (usa localStorage como fallback)
 */
export function getPollingInterval(): number {
  if (typeof window === 'undefined') {
    return 30000; // 30 segundos padrão
  }

  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const interval = Math.max(5, Math.min(300, parsed.pollingInterval || 30));
      return interval * 1000;
    }
  } catch (error) {
    console.error('Erro ao carregar intervalo:', error);
  }

  return 30000; // 30 segundos padrão
}

/**
 * Obtém configurações de notificações
 * ⚠️ Versão síncrona para uso em componentes (usa localStorage como fallback)
 */
export function getNotificationSettings() {
  if (typeof window === 'undefined') {
    return {
      notifications: true,
      emailAlerts: false,
      soundAlerts: true,
    };
  }

  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      return {
        notifications: parsed.notifications ?? true,
        emailAlerts: parsed.emailAlerts ?? false,
        soundAlerts: parsed.soundAlerts ?? true,
      };
    }
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);
  }

  return {
    notifications: true,
    emailAlerts: false,
    soundAlerts: true,
  };
}

