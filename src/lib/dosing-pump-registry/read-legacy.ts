/**
 * Lectura del registro desde el storage actual (ec_config_view + ph_config_view vía API).
 * No escribe. No migra BD.
 */

import {
  nutrientRelayNumber,
  parseNutrientFlowRate,
  type NutrientFlowRow,
} from '@/lib/pump-calibration';
import {
  isPeristalticDosingRelay,
  PERISTALTIC_RELAY_MIN,
  PERISTALTIC_RELAY_MAX,
  type DosingPumpRegistry,
  type DosingPumpSlot,
} from './types';

function unwrapConfigRow(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== 'object') return {};
  const row = json as Record<string, unknown>;
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    return row.data as Record<string, unknown>;
  }
  return row;
}

function parseNutrientsJson(raw: unknown): NutrientFlowRow[] {
  if (Array.isArray(raw)) return raw as NutrientFlowRow[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as NutrientFlowRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function upsertSlot(map: Map<number, DosingPumpSlot>, slot: DosingPumpSlot) {
  const prev = map.get(slot.relayIndex);
  if (!prev) {
    map.set(slot.relayIndex, slot);
    return;
  }
  // Preferir nome de produto; conservar mejor caudal > 0
  const flow =
    (slot.flowRateMlPerSec ?? 0) > (prev.flowRateMlPerSec ?? 0)
      ? slot.flowRateMlPerSec
      : prev.flowRateMlPerSec;
  const name =
    slot.name && !slot.name.startsWith('Relé')
      ? slot.name
      : prev.name || slot.name;
  map.set(slot.relayIndex, {
    relayIndex: slot.relayIndex,
    name,
    flowRateMlPerSec: flow,
    source: prev.source === 'ec_nutrient' ? prev.source : slot.source,
  });
}

/**
 * Construye el registro a partir de JSON ya cargados (tests / callers con cache).
 */
export function buildDosingPumpRegistryFromConfigs(
  deviceId: string,
  ecConfig: Record<string, unknown> | null | undefined,
  phConfig: Record<string, unknown> | null | undefined
): DosingPumpRegistry {
  const map = new Map<number, DosingPumpSlot>();

  if (ecConfig) {
    for (const n of parseNutrientsJson(ecConfig.nutrients)) {
      const relay = nutrientRelayNumber(n);
      if (relay == null) continue;
      const flow = parseNutrientFlowRate(n);
      upsertSlot(map, {
        relayIndex: relay,
        name: String(n.name ?? '').trim() || `Relé ${relay}`,
        flowRateMlPerSec: flow ?? null,
        source: 'ec_nutrient',
      });
    }
  }

  if (phConfig) {
    const up = Number(phConfig.relay_ph_up);
    const down = Number(phConfig.relay_ph_down);
    const flowUp = Number(phConfig.flow_rate_ph_up);
    const flowDown = Number(phConfig.flow_rate_ph_down);

    if (Number.isFinite(up) && up >= 0) {
      upsertSlot(map, {
        relayIndex: Math.trunc(up),
        name: 'pH+',
        flowRateMlPerSec: flowUp > 0 ? flowUp : null,
        source: 'ph_up',
      });
    }
    if (Number.isFinite(down) && down >= 0) {
      upsertSlot(map, {
        relayIndex: Math.trunc(down),
        name: 'pH−',
        flowRateMlPerSec: flowDown > 0 ? flowDown : null,
        source: 'ph_down',
      });
    }
  }

  const slots = Array.from(map.values()).sort((a, b) => a.relayIndex - b.relayIndex);
  return { deviceId, slots };
}

/**
 * Garantiza los 6 slots peristálticos (0–5), aunque no estén en Auto EC/pH.
 * No inventa caudal — solo hace visibles las bombas libres para Calibragem.
 */
export function fillEmptyPeristalticSlots(
  registry: DosingPumpRegistry,
  nameOf?: (relayIndex: number) => string
): DosingPumpRegistry {
  const map = new Map<number, DosingPumpSlot>();
  for (const s of registry.slots) {
    if (!isPeristalticDosingRelay(s.relayIndex)) continue;
    map.set(s.relayIndex, s);
  }
  for (let i = PERISTALTIC_RELAY_MIN; i <= PERISTALTIC_RELAY_MAX; i++) {
    if (map.has(i)) continue;
    map.set(i, {
      relayIndex: i,
      name: nameOf?.(i) ?? `Relé ${i}`,
      flowRateMlPerSec: null,
      source: 'unassigned',
    });
  }
  return {
    deviceId: registry.deviceId,
    slots: Array.from(map.values()).sort((a, b) => a.relayIndex - b.relayIndex),
  };
}

export type ReadRegistryOptions = {
  /**
   * Si true (default en producto), solo slots 0–5.
   * Relés 6–7 no entran al registro de peristálticas.
   */
  onlyPeristalticSlots?: boolean;
};

/**
 * Fetch APIs de calibragem/EC/pH y arma el registro.
 */
export async function readLegacyDosingPumpRegistry(
  deviceId: string,
  options: ReadRegistryOptions = {}
): Promise<DosingPumpRegistry> {
  const onlyPeristaltic = options.onlyPeristalticSlots !== false;
  if (!deviceId?.trim() || deviceId === 'default_device') {
    return { deviceId, slots: [] };
  }

  const [ecRes, phRes] = await Promise.all([
    fetch(`/api/ec-controller/config?device_id=${encodeURIComponent(deviceId)}`),
    fetch(`/api/ph-controller/config?device_id=${encodeURIComponent(deviceId)}`),
  ]);

  const ec = ecRes.ok ? unwrapConfigRow(await ecRes.json()) : null;
  const ph = phRes.ok ? unwrapConfigRow(await phRes.json()) : null;
  const full = buildDosingPumpRegistryFromConfigs(deviceId, ec, ph);

  if (!onlyPeristaltic) return full;

  return {
    deviceId,
    slots: full.slots.filter((s) => isPeristalticDosingRelay(s.relayIndex)),
  };
}
