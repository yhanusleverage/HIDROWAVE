import { masterRelayKey } from '@/lib/master-relay-options';
import {
  isCalibratedPump,
  readLegacyDosingPumpRegistry,
  type DosingPumpSlot,
} from '@/lib/dosing-pump-registry';

/** Bomba dosificadora (Core) com vazão calibrada — para modo dose_ml nas regras. */
export type DosingPumpOption = {
  value: string;
  label: string;
  relayNumber: number;
  flowRate: number;
  name: string;
};

function slotToOption(slot: DosingPumpSlot): DosingPumpOption | null {
  if (!isCalibratedPump(slot) || slot.flowRateMlPerSec == null) return null;
  const flowRate = slot.flowRateMlPerSec;
  return {
    value: masterRelayKey(slot.relayIndex),
    label: `Core: ${slot.name} (${flowRate.toFixed(3)} ml/s)`,
    relayNumber: slot.relayIndex,
    flowRate,
    name: slot.name,
  };
}

/**
 * Bombas do Core com flowRate > 0 (nutrientes EC + pH+/pH−).
 * Lee el registro legacy (mismas APIs que Calibragem).
 * Por defecto solo relés peristálticos 0–5 (ver DOSING_PUMP_REGISTRY_MODEL).
 */
export async function fetchDosingPumpOptions(
  deviceId: string
): Promise<DosingPumpOption[]> {
  const registry = await readLegacyDosingPumpRegistry(deviceId, {
    onlyPeristalticSlots: true,
  });
  return registry.slots
    .map(slotToOption)
    .filter((o): o is DosingPumpOption => o != null)
    .sort((a, b) => a.relayNumber - b.relayNumber);
}
