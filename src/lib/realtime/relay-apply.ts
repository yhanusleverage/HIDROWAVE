import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { RelayMasterRow, RelaySlaveRow } from '@/lib/realtime/relay-states';
import { resolveSlaveOnline } from '@/lib/realtime/slave-status';

/** Fallback REST lento para timers y eventos perdidos tras reconexión WS. */
export const RELAY_REST_FALLBACK_MS = 90 * 1000;

export type LocalRelayState = {
  id: number;
  name: string;
  state: boolean;
};

function slaveMatchesRow(slave: ESPNowSlave, row: RelaySlaveRow): boolean {
  if (row.device_id && slave.device_id === row.device_id) return true;
  if (row.slave_mac_address && slave.macAddress === row.slave_mac_address) return true;
  return false;
}

/** Aplica payload WS de relay_slaves al estado local sin REST. */
export function applySlaveRelayRow(
  slaves: ESPNowSlave[],
  row: RelaySlaveRow
): { slaves: ESPNowSlave[]; matched: boolean } {
  if (!row.device_id && !row.slave_mac_address) {
    return { slaves, matched: false };
  }

  const states = row.relay_states ?? [];
  const hasTimers = row.relay_has_timers ?? [];
  const remainingTimes = row.relay_remaining_times ?? [];

  let matched = false;
  const lastUpdate = row.last_update ?? row.updated_at;
  const updated = slaves.map((slave) => {
    if (!slaveMatchesRow(slave, row)) return slave;
    matched = true;
    const online = resolveSlaveOnline(lastUpdate, slave.last_seen);
    return {
      ...slave,
      status: online ? ('online' as const) : ('offline' as const),
      last_seen: lastUpdate ?? slave.last_seen,
      relays: slave.relays.map((relay) => {
        const idx = relay.id;
        if (idx < 0 || idx >= Math.max(states.length, 8)) return relay;
        return {
          ...relay,
          state: states[idx] ?? relay.state,
          has_timer: hasTimers[idx] ?? relay.has_timer,
          remaining_time: remainingTimes[idx] ?? relay.remaining_time,
        };
      }),
    };
  });

  return { slaves: matched ? updated : slaves, matched };
}

/** Aplica payload WS de relay_master a relés locales del master (doser 0-8). */
export function applyMasterRelayRow(
  localRelays: LocalRelayState[],
  row: RelayMasterRow
): LocalRelayState[] {
  const doser = row.doser_relay_states;
  if (!doser?.length) return localRelays;

  return localRelays.map((relay) => {
    if (relay.id >= 0 && relay.id < doser.length) {
      return { ...relay, state: doser[relay.id] ?? relay.state };
    }
    return relay;
  });
}

export function relayStatesMapFromSlaves(slaves: ESPNowSlave[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  slaves.forEach((slave) => {
    slave.relays.forEach((relay) => {
      map.set(`${slave.macAddress}-${relay.id}`, relay.state ?? false);
    });
  });
  return map;
}

/** Solo devuelve un Map nuevo si algún estado cambió (evita re-renders innecesarios). */
export function mergeRelayStatesMap(
  prev: Map<string, boolean>,
  slaves: ESPNowSlave[]
): Map<string, boolean> {
  const next = relayStatesMapFromSlaves(slaves);
  let changed = next.size !== prev.size;
  if (!changed) {
    next.forEach((value, key) => {
      if (prev.get(key) !== value) changed = true;
    });
  }
  return changed ? next : prev;
}
