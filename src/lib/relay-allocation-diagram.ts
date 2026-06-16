import type { RelayAllocationRegistry } from '@/lib/relay-allocation';
import { getDoserRelaySlots } from '@/lib/relay-allocation';

export interface RelayMapMasterRelay {
  id: number;
  name: string;
  device: 'master';
  state: 'on' | 'off';
  conflicts?: string[];
}

/** Converte registro derivado → formato RelayMapDiagram (master dosificadores 0–7). */
export function registryToMasterRelayDiagram(
  registry: RelayAllocationRegistry,
  doserRelayStates?: boolean[]
): RelayMapMasterRelay[] {
  const slots = getDoserRelaySlots(registry);
  return slots.map((slot) => ({
    id: slot.relayNumber,
    name: slot.name,
    device: 'master' as const,
    state: doserRelayStates?.[slot.relayNumber] ? 'on' : 'off',
    conflicts: slot.isFree
      ? undefined
      : slot.claims.map((c) => `${c.label} (${c.owner})`),
  }));
}
