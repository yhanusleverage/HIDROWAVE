/**
 * Seleção e validação de relés ESP-NOW slave (diluição EC, etc.).
 */

import type { ESPNowSlave } from '@/lib/esp-now-slaves';

export type SlaveRelayRef = {
  slaveMac: string;
  relayId: number;
};

export type SlaveRelayOption = {
  slaveMac: string;
  slaveName: string;
  relayId: number;
  relayName: string;
  slaveOnline: boolean;
  valueKey: string;
};

export function normalizeSlaveMac(mac: string | null | undefined): string {
  return (mac || '').trim().toUpperCase();
}

export function slaveRelayKey(ref: SlaveRelayRef): string {
  return `${normalizeSlaveMac(ref.slaveMac)}|${ref.relayId}`;
}

export function parseSlaveRelayKey(key: string): SlaveRelayRef | null {
  const sep = key.lastIndexOf('|');
  if (sep <= 0) return null;
  const slaveMac = normalizeSlaveMac(key.slice(0, sep));
  const relayId = parseInt(key.slice(sep + 1), 10);
  if (!slaveMac || !Number.isFinite(relayId) || relayId < 0 || relayId > 7) return null;
  return { slaveMac, relayId };
}

export function buildSlaveRelayOptions(
  slaves: ESPNowSlave[],
  reserved: SlaveRelayRef[],
  current?: SlaveRelayRef | null
): SlaveRelayOption[] {
  const reservedKeys = new Set(
    reserved
      .filter((r) => r.slaveMac && r.relayId >= 0)
      .map((r) => slaveRelayKey(r))
  );
  const currentKey = current?.slaveMac ? slaveRelayKey(current) : null;

  const options: SlaveRelayOption[] = [];

  for (const slave of slaves) {
    const mac = normalizeSlaveMac(slave.macAddress);
    if (!mac) continue;

    for (const relay of slave.relays) {
      const key = `${mac}|${relay.id}`;
      if (reservedKeys.has(key) && key !== currentKey) continue;

      options.push({
        slaveMac: mac,
        slaveName: slave.name || mac,
        relayId: relay.id,
        relayName: relay.name || `Relé ${relay.id}`,
        slaveOnline: slave.status === 'online',
        valueKey: key,
      });
    }
  }

  return options.sort((a, b) => {
    const nameCmp = a.slaveName.localeCompare(b.slaveName);
    if (nameCmp !== 0) return nameCmp;
    return a.relayId - b.relayId;
  });
}

export type DilutionSlaveConfig = {
  dilution_drain_slave_mac?: string | null;
  dilution_drain_relay?: number | null;
  dilution_fill_slave_mac?: string | null;
  dilution_fill_relay?: number | null;
};

export function dilutionDrainRef(config: DilutionSlaveConfig): SlaveRelayRef | null {
  const mac = normalizeSlaveMac(config.dilution_drain_slave_mac);
  const relayId = Number(config.dilution_drain_relay);
  if (!mac || !Number.isFinite(relayId) || relayId < 0 || relayId > 7) return null;
  return { slaveMac: mac, relayId };
}

export function dilutionFillRef(config: DilutionSlaveConfig): SlaveRelayRef | null {
  const mac = normalizeSlaveMac(config.dilution_fill_slave_mac);
  const relayId = Number(config.dilution_fill_relay);
  if (!mac || !Number.isFinite(relayId) || relayId < 0 || relayId > 7) return null;
  return { slaveMac: mac, relayId };
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateEcDilutionSlaveAssignment(
  config: DilutionSlaveConfig,
  slaves: ESPNowSlave[]
): ValidationResult {
  const drain = dilutionDrainRef(config);
  const fill = dilutionFillRef(config);

  if (!drain || !fill) {
    return {
      ok: false,
      error: 'Selecione relé slave de dreno e reposição (ESP-NOW).',
    };
  }

  if (slaveRelayKey(drain) === slaveRelayKey(fill)) {
    return {
      ok: false,
      error: 'Dreno e reposição não podem ser o mesmo relé slave.',
    };
  }

  const findRelay = (ref: SlaveRelayRef) => {
    const mac = normalizeSlaveMac(ref.slaveMac);
    const slave = slaves.find((s) => normalizeSlaveMac(s.macAddress) === mac);
    if (!slave) return null;
    return slave.relays.find((r) => r.id === ref.relayId) ?? null;
  };

  if (!findRelay(drain)) {
    return { ok: false, error: 'Relé de dreno não encontrado no slave selecionado.' };
  }
  if (!findRelay(fill)) {
    return { ok: false, error: 'Relé de reposição não encontrado no slave selecionado.' };
  }

  return { ok: true };
}

export function formatSlaveRelayLabel(option: SlaveRelayOption): string {
  return `${option.slaveName} · R${option.relayId} ${option.relayName}`;
}
