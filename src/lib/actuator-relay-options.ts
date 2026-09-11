import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import {
  type MasterRelayOption,
  masterRelayKey,
  slaveRelayKey,
} from '@/lib/master-relay-options';
import { isPeristalticDosingRelay, PERISTALTIC_RELAY_MIN, PERISTALTIC_RELAY_MAX } from '@/lib/dosing-pump-registry';

export type ActuatorRelayOption = {
  value: string;
  label: string;
  kind: 'master' | 'slave';
  relayId: number;
  slaveMac?: string;
};

function looksLikeMac(s: string): boolean {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(s.trim());
}

function atlasDisplayName(slave: ESPNowSlave): string {
  const name = (slave.name || '').trim();
  if (name && !looksLikeMac(name)) return name;
  const id = (slave.device_id || '').trim();
  if (id && !looksLikeMac(id)) return id;
  return 'HydroWave Atlas';
}

export type BuildActuatorRelayOptionsOpts = {
  /**
   * Se true (default), Core só inclui peristálticas 0–5 (sem Relé 6/7).
   * Atlas continua completo.
   */
  onlyPeristalticCore?: boolean;
  /** Se true, não inclui Atlas — só as 6 bombas Core. */
  corePumpsOnly?: boolean;
};

/**
 * Lista Core + Atlas para ações simples e builder.
 * Labels amigáveis — MAC nunca na UI. Deduplica por value.
 */
export function buildActuatorRelayOptions(
  masterRelays: MasterRelayOption[],
  espnowSlaves: ESPNowSlave[],
  opts: BuildActuatorRelayOptionsOpts = {}
): ActuatorRelayOption[] {
  const onlyPeristalticCore = opts.onlyPeristalticCore !== false;
  const corePumpsOnly = opts.corePumpsOnly === true;
  const byValue = new Map<string, ActuatorRelayOption>();

  for (const relay of masterRelays) {
    if (!Number.isFinite(relay.number) || relay.number < 0) continue;
    if (onlyPeristalticCore) {
      if (!isPeristalticDosingRelay(relay.number)) continue;
    } else if (relay.number > 7) {
      continue;
    }
    const value = masterRelayKey(relay.number);
    byValue.set(value, {
      value,
      label: relay.name?.trim() || `Relé ${relay.number}`,
      kind: 'master',
      relayId: relay.number,
    });
  }

  if (!corePumpsOnly) {
    for (const slave of espnowSlaves) {
      const atlasName = atlasDisplayName(slave);
      for (const relay of slave.relays) {
        const value = slaveRelayKey(slave.macAddress, relay.id);
        byValue.set(value, {
          value,
          label: `${atlasName}: ${relay.id} - ${relay.name || `Relé ${relay.id}`}`,
          kind: 'slave',
          relayId: relay.id,
          slaveMac: slave.macAddress,
        });
      }
    }
  }

  return Array.from(byValue.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'master' ? -1 : 1;
    if (a.kind === 'slave' && a.slaveMac !== b.slaveMac) {
      return (a.slaveMac || '').localeCompare(b.slaveMac || '');
    }
    return a.relayId - b.relayId;
  });
}

/** Só as 6 bombas peristálticas Core (0–5) — Passos / dosagem. Sempre 6 entradas. */
export function buildCorePeristalticPumpOptions(
  masterRelays: MasterRelayOption[]
): ActuatorRelayOption[] {
  const byNum = new Map(
    masterRelays
      .filter((r) => Number.isFinite(r.number))
      .map((r) => [r.number, r] as const)
  );
  const options: ActuatorRelayOption[] = [];
  for (let i = PERISTALTIC_RELAY_MIN; i <= PERISTALTIC_RELAY_MAX; i++) {
    const r = byNum.get(i);
    options.push({
      value: masterRelayKey(i),
      label: r?.name?.trim() || `Relé ${i}`,
      kind: 'master',
      relayId: i,
    });
  }
  return options;
}

export function splitActuatorOptionsByKind(options: ActuatorRelayOption[]): {
  core: ActuatorRelayOption[];
  atlas: ActuatorRelayOption[];
} {
  return {
    core: options.filter((o) => o.kind === 'master'),
    atlas: options.filter((o) => o.kind === 'slave'),
  };
}
