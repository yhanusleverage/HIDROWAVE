/**
 * Helpers alinhados ao schema Supabase em produção.
 * device_status: hub central (sem master_device_id, sem user_settings).
 * relay_slaves: master_device_id vive aqui, não em device_status.
 * users: PK = email (sem coluna id).
 */

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isValidMac(mac?: string | null): boolean {
  if (!mac || mac.trim() === '' || mac === '00:00:00:00:00:00') return false;
  return true;
}

export function isTestEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  return e === 'temp@local.dev' || e.includes('test') || e.includes('temp');
}

export function isSimulationDevice(device: {
  device_id?: string;
  device_name?: string;
  device_type?: string;
}): boolean {
  const deviceId = device.device_id?.toLowerCase() || '';
  const deviceName = device.device_name?.toLowerCase() || '';
  const deviceType = device.device_type?.toLowerCase() || '';
  const markers = ['simul', 'test', 'mock', 'demo'];
  return markers.some(
    (m) => deviceId.includes(m) || deviceName.includes(m) || deviceType.includes(m)
  );
}

export function isMasterDeviceType(deviceType?: string | null): boolean {
  const t = (deviceType || '').toLowerCase();
  return t.includes('hydroponic') || t.includes('master');
}

export function isSlaveDeviceType(deviceType?: string | null): boolean {
  const t = (deviceType || '').toLowerCase();
  return (
    t.includes('slave') ||
    t.includes('relaybox') ||
    (t.includes('relay') && !t.includes('hydroponic'))
  );
}

/** Colunas reais de device_status (produção). */
export const DEVICE_STATUS_COLUMNS = [
  'id',
  'device_id',
  'last_seen',
  'wifi_rssi',
  'free_heap',
  'uptime_seconds',
  'relay_states',
  'is_online',
  'firmware_version',
  'ip_address',
  'created_at',
  'updated_at',
  'user_email',
  'mac_address',
  'device_name',
  'location',
  'device_type',
  'reboot_count',
] as const;

/** Columnas reales de relay_commands (producción). */
export const RELAY_COMMANDS_COLUMNS = [
  'id',
  'device_id',
  'relay_number',
  'action',
  'duration_seconds',
  'status',
  'created_at',
  'sent_at',
  'completed_at',
  'created_by',
  'error_message',
  'target_device_id',
] as const;

export type RelayCommandStatus = 'pending' | 'sent' | 'completed' | 'failed';

/** duration_seconds prod: NULL = permanente (CHECK no acepta 0). */
export function normalizeRelayDuration(seconds?: number | null): number | null {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  return seconds;
}

/** Supabase/PostgREST cuando la tabla no está en el schema (prod sin migrar). */
export function isSupabaseMissingTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}
