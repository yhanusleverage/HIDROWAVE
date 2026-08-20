export interface MasterRelayOption {
  number: number;
  name: string;
}

export const DEFAULT_MASTER_RELAYS: MasterRelayOption[] = Array.from({ length: 8 }, (_, i) => ({
  number: i,
  name: `Relé Master ${i}`,
}));

export function masterRelayKey(relayIndex: number): string {
  return `master_${relayIndex}`;
}

export function slaveRelayKey(mac: string, relayIndex: number): string {
  return `slave_${mac}_${relayIndex}`;
}

export function parseActuatorKey(key: string): {
  target: 'master' | 'slave';
  relayIndex: number;
  slaveMac?: string;
} | null {
  if (key.startsWith('master_')) {
    const relayIndex = parseInt(key.slice('master_'.length), 10);
    if (Number.isNaN(relayIndex)) return null;
    return { target: 'master', relayIndex };
  }
  if (key.startsWith('slave_')) {
    const rest = key.slice('slave_'.length);
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore <= 0) return null;
    const mac = rest.slice(0, lastUnderscore);
    const relayIndex = parseInt(rest.slice(lastUnderscore + 1), 10);
    if (Number.isNaN(relayIndex)) return null;
    return { target: 'slave', relayIndex, slaveMac: mac };
  }
  return null;
}

export function actuatorRefToKey(ref: {
  target: 'master' | 'slave';
  relayIndex: number;
  slaveMac?: string;
}): string {
  if (ref.target === 'slave' && ref.slaveMac) {
    return slaveRelayKey(ref.slaveMac, ref.relayIndex);
  }
  return masterRelayKey(ref.relayIndex);
}

export function instructionToActuatorKey(instruction: {
  target?: 'master' | 'slave';
  relay_number?: number;
  slave_mac?: string;
}): string {
  if (instruction.target === 'slave' && instruction.slave_mac != null && instruction.relay_number != null) {
    return slaveRelayKey(instruction.slave_mac, instruction.relay_number);
  }
  if (instruction.relay_number != null) {
    return masterRelayKey(instruction.relay_number);
  }
  return '';
}
