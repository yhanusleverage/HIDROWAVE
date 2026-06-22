/**
 * Esquema v1 — hidrowave/{device_id}/command (QoS 1)
 * Fonte de verdade alinhada com docs/mqtt/04_MODELAGEM_TOPICOS_PAYLOADS.md
 * e MqttCommandParser.cpp no firmware.
 */

export const MQTT_CMD_SCHEMA_VERSION = 1 as const;

/** Mesmo regex do bridge Node e firmware */
export const DEVICE_ID_RE = /^ESP32_HIDRO_[0-9A-F]{6}$/;

/** MAC slave ESP-NOW (AA:BB:CC:DD:EE:FF ou AA-BB-...) */
export const SLAVE_MAC_RE =
  /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export type MqttRelayAction = 'on' | 'off';
export type MqttCommandType = 'manual' | 'rule' | 'peristaltic';

/** Payload JSON publicado no tópico command (v1) */
export type MqttRelayCommandMessageV1 = {
  v: typeof MQTT_CMD_SCHEMA_VERSION;
  id: number;
  cmd: 'relay';
  device_id: string;
  relay_index: number;
  action: MqttRelayAction;
  duration_s: number;
  source: 'web' | 'api' | 'rule';
  command_type: MqttCommandType;
  priority: number;
  triggered_by: string;
  target_device_id?: string;
  slave_mac_address?: string;
  rule_id?: string;
  rule_name?: string;
};

/** Input para notify/publish após INSERT relay_commands */
export type MqttRelayCommandNotifyInput = {
  device_id: string;
  id: number;
  relay_index: number;
  action: MqttRelayAction;
  duration_s?: number | null;
  target_device_id?: string | null;
  command_type?: MqttCommandType;
  priority?: number;
  triggered_by?: string;
  rule_id?: string | null;
  rule_name?: string | null;
  source?: MqttRelayCommandMessageV1['source'];
};

const MAX_JSON_BYTES = 480;

export function defaultPriority(commandType: MqttCommandType): number {
  switch (commandType) {
    case 'peristaltic':
      return 80;
    case 'rule':
      return 50;
    default:
      return 10;
  }
}

export function validateDeviceId(deviceId: string): boolean {
  return DEVICE_ID_RE.test(deviceId);
}

export function validateRelayIndex(
  relayIndex: number,
  isSlave: boolean
): boolean {
  if (!Number.isInteger(relayIndex)) return false;
  return isSlave ? relayIndex >= 0 && relayIndex <= 7 : relayIndex >= 0 && relayIndex <= 15;
}

export function normalizeTargetDeviceId(
  target?: string | null
): string | undefined {
  const t = target?.trim();
  if (!t || t === 'local' || t === 'master') return undefined;
  return t;
}

export function isSlaveCommand(target?: string | null): boolean {
  return normalizeTargetDeviceId(target) !== undefined;
}

export function validateNotifyInput(input: MqttRelayCommandNotifyInput): string | null {
  if (!input.id || input.id <= 0) return 'id inválido (deve ser relay_commands.id > 0)';
  if (!validateDeviceId(input.device_id)) return `device_id inválido: ${input.device_id}`;
  const slave = isSlaveCommand(input.target_device_id);
  if (!validateRelayIndex(input.relay_index, slave)) {
    return slave
      ? `relay_index slave inválido: ${input.relay_index} (0-7)`
      : `relay_index master inválido: ${input.relay_index} (0-15)`;
  }
  if (input.action !== 'on' && input.action !== 'off') return `action inválida: ${input.action}`;
  const target = normalizeTargetDeviceId(input.target_device_id);
  if (target && !SLAVE_MAC_RE.test(target)) {
    return `target_device_id não é MAC válido: ${target}`;
  }
  if (input.priority !== undefined && (input.priority < 0 || input.priority > 100)) {
    return 'priority deve estar entre 0 e 100';
  }
  return null;
}

export function buildMqttRelayCommandMessageV1(
  input: MqttRelayCommandNotifyInput
): MqttRelayCommandMessageV1 {
  const err = validateNotifyInput(input);
  if (err) throw new Error(`[MQTT CMD schema] ${err}`);

  const commandType = input.command_type ?? 'manual';
  const target = normalizeTargetDeviceId(input.target_device_id);
  const duration = Math.max(0, Math.floor(input.duration_s ?? 0));

  const msg: MqttRelayCommandMessageV1 = {
    v: MQTT_CMD_SCHEMA_VERSION,
    id: input.id,
    cmd: 'relay',
    device_id: input.device_id,
    relay_index: input.relay_index,
    action: input.action,
    duration_s: duration,
    source: input.source ?? 'web',
    command_type: commandType,
    priority: input.priority ?? defaultPriority(commandType),
    triggered_by: input.triggered_by ?? 'mqtt_push',
  };

  if (target) {
    msg.target_device_id = target;
    msg.slave_mac_address = target;
  }
  if (input.rule_id) msg.rule_id = input.rule_id;
  if (input.rule_name) msg.rule_name = input.rule_name;

  const json = JSON.stringify(msg);
  if (json.length > MAX_JSON_BYTES) {
    throw new Error(`[MQTT CMD schema] payload ${json.length}B > ${MAX_JSON_BYTES}B`);
  }

  return msg;
}

export function mqttCommandTopic(deviceId: string): string {
  if (!validateDeviceId(deviceId)) {
    throw new Error(`[MQTT CMD schema] device_id inválido para tópico: ${deviceId}`);
  }
  return `hidrowave/${deviceId}/command`;
}
