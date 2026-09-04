/**
 * Config bomba de circulação → MQTT retained.
 * Tópico: hidrowave/{device_id}/circ/config
 *
 * ESP: setCirculationTarget (NVS) + upsert fn_circulation em SPIFFS.
 */
import { validateDeviceId } from '@/lib/mqtt-relay-command-schema';

export function mqttCircConfigTopic(deviceId: string): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT CIRC] device_id inválido: ${deviceId}`);
  }
  return `hidrowave/${deviceId}/circ/config`;
}

export function buildCircConfigMqttPayload(
  deviceId: string,
  binding: { slaveMac: string; relayIndex: number } | null
): Record<string, unknown> {
  if (
    !binding?.slaveMac?.trim() ||
    binding.relayIndex < 0 ||
    binding.relayIndex > 7
  ) {
    return {
      v: 1,
      device_id: deviceId,
      enabled: false,
      slave_mac: '',
      relay_index: -1,
    };
  }
  return {
    v: 1,
    device_id: deviceId,
    enabled: true,
    slave_mac: binding.slaveMac.trim().toUpperCase(),
    relay_index: binding.relayIndex,
  };
}
