/**
 * Config Auto EC/pH → MQTT retained (mesmo objeto da view, sem array PostgREST).
 * Tópicos: hidrowave/{device_id}/ec/config | .../ph/config
 */
import { validateDeviceId } from '@/lib/mqtt-relay-command-schema';
import { EC_WRITABLE_KEYS, PH_WRITABLE_KEYS } from '@/lib/controller-config-api';

export type ControllerConfigKind = 'ec' | 'ph';

export function mqttControllerConfigTopic(
  deviceId: string,
  kind: ControllerConfigKind
): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT CONFIG] device_id inválido: ${deviceId}`);
  }
  return `hidrowave/${deviceId}/${kind}/config`;
}

const DROP_KEYS = [
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'flow_rate', // legado — vazão real está em nutrients[].flowRate
  'k_value',
  'k_acid',
  'k_base',
  '_debug',
] as const;

function pickMqttRow(
  row: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const copy = { ...row };
  for (const key of DROP_KEYS) {
    delete copy[key];
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === 'updated_at' || key === 'created_by') continue;
    if (key in copy && copy[key] !== undefined) {
      out[key] = copy[key];
    }
  }
  delete out.flow_rate;
  return out;
}

export function buildEcConfigMqttPayload(
  deviceId: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  return {
    v: 1,
    device_id: deviceId,
    ...pickMqttRow(row, EC_WRITABLE_KEYS),
  };
}

export function buildPhConfigMqttPayload(
  deviceId: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  return {
    v: 1,
    device_id: deviceId,
    ...pickMqttRow(row, PH_WRITABLE_KEYS),
  };
}
