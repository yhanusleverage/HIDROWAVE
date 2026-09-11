/**
 * Registro lógico de bombas dosadoras (peristálticas).
 * Fase 0: tipos + lectura legacy — no cambia persistencia.
 *
 * @see docs/engineering/DOSING_PUMP_REGISTRY_MODEL.md
 */

import { HMI_PUMP_COUNT } from '@/lib/pump-calibration';

/** Relés Master con bomba peristáltica de producto (UI dosificación). */
export const PERISTALTIC_RELAY_MIN = 0;
export const PERISTALTIC_RELAY_MAX = HMI_PUMP_COUNT - 1; // 0–5
export const PERISTALTIC_RELAY_COUNT = HMI_PUMP_COUNT; // 6

/** Cómo se obtuvo el slot en la lectura legacy (EC nutrients / pH columns). */
export type DosingPumpLegacySource =
  | 'ec_nutrient'
  | 'ph_up'
  | 'ph_down'
  | 'orphan_calibrated'
  /** Slot 0–5 aún sin fila EC/pH — visible en Calibragem */
  | 'unassigned';

/**
 * Capa A — una bomba del registro.
 * `flowRateMlPerSec` null/≤0 = sin calibrar (no entra en listas ml).
 */
export type DosingPumpSlot = {
  relayIndex: number;
  name: string;
  flowRateMlPerSec: number | null;
  source: DosingPumpLegacySource;
};

export type DosingPumpRegistry = {
  deviceId: string;
  /** Slots con o sin caudal (lectura completa). */
  slots: DosingPumpSlot[];
};

export function isPeristalticDosingRelay(relayIndex: number): boolean {
  return (
    Number.isFinite(relayIndex) &&
    relayIndex >= PERISTALTIC_RELAY_MIN &&
    relayIndex <= PERISTALTIC_RELAY_MAX
  );
}

export function isCalibratedPump(slot: DosingPumpSlot): boolean {
  return slot.flowRateMlPerSec != null && slot.flowRateMlPerSec > 0;
}
