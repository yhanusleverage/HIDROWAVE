/**
 * Utilitário para gerenciar configurações do sistema.
 * Produção: device_status não tem master_device_id nem user_settings — persistência em localStorage.
 */

import {
  isMasterDeviceType,
  isSimulationDevice,
  isValidMac,
  normalizeEmail,
} from './db-schema';
import { supabase } from './supabase';

const STORAGE_KEY = 'hydrowave_settings';

export interface Settings {
  supabaseUrl: string;
  supabaseKey: string;
  pollingInterval: number;
  notifications: boolean;
  emailAlerts: boolean;
  soundAlerts: boolean;
  language: string;
  theme: string;
  timezone: string;
  ecThresholds: {
    dangerMin: number;
    dangerMax: number;
    warningMin: number;
    warningMax: number;
  };
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
  timezone: 'America/Sao_Paulo',
  ecThresholds: {
    dangerMin: 250,
    dangerMax: 750,
    warningMin: 400,
    warningMax: 600,
  },
};

function parseStoredSettings(raw: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...raw,
    pollingInterval: Math.max(
      5,
      Math.min(300, raw.pollingInterval || defaultSettings.pollingInterval)
    ),
  };
}

function readLocalSettings(): Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (!savedSettings) return null;
    return parseStoredSettings(JSON.parse(savedSettings) as Partial<Settings>);
  } catch (error) {
    console.error('❌ [SETTINGS] Erro ao carregar do localStorage:', error);
    return null;
  }
}

function writeLocalSettings(settings: Settings): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('❌ [SETTINGS] Erro ao salvar no localStorage:', error);
    return false;
  }
}

/** Master = device_type hydroponic/master com MAC válido (sem coluna master_device_id em prod). */
async function getMasterDeviceId(userEmail: string): Promise<string | null> {
  try {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) return null;

    const { data, error } = await supabase
      .from('device_status')
      .select('device_id, device_type, mac_address, device_name')
      .eq('user_email', normalizedEmail)
      .order('last_seen', { ascending: false });

    if (error || !data?.length) {
      console.warn('⚠️ [SETTINGS] Nenhum dispositivo encontrado para:', normalizedEmail);
      return null;
    }

    const master = data.find(
      (device) =>
        isValidMac(device.mac_address) &&
        isMasterDeviceType(device.device_type) &&
        !isSimulationDevice(device)
    );

    return master?.device_id ?? null;
  } catch (error) {
    console.error('❌ [SETTINGS] Erro ao buscar Master:', error);
    return null;
  }
}

/**
 * Carrega configurações — localStorage (prod); getMasterDeviceId só para contexto futuro.
 */
export async function loadSettings(userEmail?: string): Promise<Settings> {
  void userEmail;
  const local = readLocalSettings();
  if (local) {
    console.log('✅ [SETTINGS] Configurações carregadas do localStorage');
    return local;
  }
  return defaultSettings;
}

/**
 * Salva configurações em localStorage (device_status.user_settings não existe em prod).
 */
export async function saveSettings(settings: Settings, userEmail?: string): Promise<boolean> {
  void userEmail;
  const ok = writeLocalSettings(settings);
  if (ok) {
    console.log('✅ [SETTINGS] Configurações salvas no localStorage');
  }
  return ok;
}

/**
 * Obtém o intervalo de polling configurado (em milissegundos)
 */
export function getPollingInterval(): number {
  const local = readLocalSettings();
  if (local) {
    return local.pollingInterval * 1000;
  }
  return 30000;
}

/**
 * Obtém configurações de notificações
 */
export function getNotificationSettings() {
  const local = readLocalSettings();
  if (local) {
    return {
      notifications: local.notifications,
      emailAlerts: local.emailAlerts,
      soundAlerts: local.soundAlerts,
    };
  }
  return {
    notifications: true,
    emailAlerts: false,
    soundAlerts: true,
  };
}

export { getMasterDeviceId };
