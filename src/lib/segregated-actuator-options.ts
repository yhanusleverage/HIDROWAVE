import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { DosingPumpOption } from '@/lib/dosing-pump-options';
import { slaveRelayKey } from '@/lib/master-relay-options';
import type { ActuatorRelayOption } from '@/lib/actuator-relay-options';

function looksLikeMac(s: string): boolean {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(s.trim());
}

/** Nome amigável Atlas — nunca mostrar MAC ao usuário. */
export function atlasDisplayName(slave: ESPNowSlave): string {
  const name = (slave.name || '').trim();
  if (name && !looksLikeMac(name)) return name;
  const id = (slave.device_id || '').trim();
  if (id && !looksLikeMac(id)) return id;
  return 'HydroWave Atlas';
}

/**
 * Listas segregadas para o builder de regras:
 * 1) Bombas dosadoras Core (calibradas)
 * 2) Relés Atlas (MAC só interno no value — UI só mostra nome)
 */
export function buildSegregatedActuatorOptions(
  dosingPumps: DosingPumpOption[],
  espnowSlaves: ESPNowSlave[]
): { dosing: ActuatorRelayOption[]; atlas: ActuatorRelayOption[] } {
  const dosing: ActuatorRelayOption[] = dosingPumps.map((p) => ({
    value: p.value,
    label: `${p.name || `Relé ${p.relayNumber}`} (${p.flowRate.toFixed(3)} ml/s)`,
    kind: 'master' as const,
    relayId: p.relayNumber,
  }));

  const atlas: ActuatorRelayOption[] = [];
  for (const slave of espnowSlaves) {
    const atlasName = atlasDisplayName(slave);
    for (const relay of slave.relays) {
      const relayName = (relay.name || '').trim() || `Relé ${relay.id}`;
      atlas.push({
        value: slaveRelayKey(slave.macAddress, relay.id),
        label: `${atlasName}: ${relay.id} - ${relayName}`,
        kind: 'slave',
        relayId: relay.id,
        slaveMac: slave.macAddress,
      });
    }
  }

  return { dosing, atlas };
}

export function flattenSegregatedActuatorOptions(
  dosingPumps: DosingPumpOption[],
  espnowSlaves: ESPNowSlave[]
): ActuatorRelayOption[] {
  const { dosing, atlas } = buildSegregatedActuatorOptions(dosingPumps, espnowSlaves);
  return [...dosing, ...atlas];
}
