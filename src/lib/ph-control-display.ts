/**
 * Domínio unificado Auto pH — UI de controle.
 * Operador: pH (e, V, s_L, q). Firmware: H⁺ (ErroH, K) — detalhe colapsável.
 */

import { mlPerLiterPerPhUnit } from '@/lib/ph-calibration';

import {
  isPlausiblePh,
  isFinitePh,
  resolvePhForDisplay,
  PH_MIN_PLAUSIBLE,
  PH_MAX_PLAUSIBLE,
} from '@/lib/realtime/hydro-ph';

export {
  isPlausiblePh,
  isFinitePh,
  resolvePhForDisplay,
  PH_MIN_PLAUSIBLE,
  PH_MAX_PLAUSIBLE,
};

export type PhDoseBlockReason =
  | 'none'
  | 'no_pv'
  | 'within_band'
  | 'auto_off';

/** Por que o ESP não dosará neste ciclo (espelha checkAutoPH — prototipo: sem filtro 3–11). */
export function resolvePhDoseBlockReason(params: {
  autoEnabled: boolean;
  displayPh: number | null;
  phSetpoint: number;
  phTolerance: number;
}): PhDoseBlockReason {
  if (!params.autoEnabled) return 'auto_off';
  if (params.displayPh === null) return 'no_pv';
  if (phErrorAbs(params.phSetpoint, params.displayPh) <= params.phTolerance) {
    return 'within_band';
  }
  return 'none';
}

export function formatPhDoseBlockMessage(reason: PhDoseBlockReason): string | null {
  switch (reason) {
    case 'no_pv':
      return 'Sem leitura pH — aguardando PV para dosagem.';
    case 'within_band':
      return 'Dentro da banda morta — sem dosagem neste ciclo.';
    case 'auto_off':
      return null;
    default:
      return null;
  }
}

const K_MIN = 1e-12;

/** Equação simbólica fixa — paridade visual Auto EC (sem números no encabezado). */
export const PH_OPERATOR_EQUATION_SYMBOL = 'u(t) = A × V × s_L × |e|';

export const PH_PULSE_EQUATION_SYMBOL = 'τ = u(t) / q';

export const PH_FIRMWARE_EQUATION_SYMBOL = 'Dose = A × |ErroH| / K';

/** s_L = ml/L por unidade pH (s_total / V). */
export function resolveActiveSL(
  mlPerPhUnitTotal: number | null,
  volumeLiters: number
): number | null {
  if (mlPerPhUnitTotal == null || mlPerPhUnitTotal <= 0) return null;
  return mlPerLiterPerPhUnit(mlPerPhUnitTotal, volumeLiters);
}

/** H⁺ = 10^(−pH) — domínio do controlador adaptativo (firmware). */
export function phToH(ph: number): number {
  if (!Number.isFinite(ph)) return 0;
  return Math.pow(10, -ph);
}

/** Erro em domínio pH: |pH_medido − SP|. */
export function phErrorAbs(phSetpoint: number, phMeasured: number): number {
  return Math.abs(phMeasured - phSetpoint);
}

/** e_H = 10^(−pH_medido) − 10^(−SP) — espelha AdaptivePHController::errorH. */
export function phErrorH(phSetpoint: number, phMeasured: number): number {
  return phToH(phMeasured) - phToH(phSetpoint);
}

/** Erro H⁺ para ~1 unidade pH abaixo do SP (seed k no firmware). */
export function erroHPerPhUnit(phSetpoint: number): number {
  const H = phToH(phSetpoint);
  return H * 9;
}

/** s = ml por unidade pH — inverso de k: s = erroH₁ / k. */
export function mlPerPhUnitFromK(phSetpoint: number, k: number): number | null {
  if (!Number.isFinite(k) || k <= K_MIN) return null;
  const erroHOne = erroHPerPhUnit(phSetpoint);
  if (erroHOne < 1e-15) return null;
  return erroHOne / k;
}

/** k inicial a partir da calibragem ml/unid pH (espelha seedKFromMlPerPhUnit no firmware). */
export function seedKFromMlPerPhUnit(phSetpoint: number, mlPerPhUnit: number): number {
  if (!Number.isFinite(mlPerPhUnit) || mlPerPhUnit < 0.01) return 0;
  if (!Number.isFinite(phSetpoint)) return 0;
  const erroHOne = erroHPerPhUnit(phSetpoint);
  if (erroHOne < 1e-15) return 0;
  return erroHOne / mlPerPhUnit;
}

export type PhCorrectionDirection = 'base' | 'acid' | 'none';

export function resolveCorrectionDirection(
  phSetpoint: number,
  phMeasured: number,
  tolerancePh: number
): PhCorrectionDirection {
  if (!isFinitePh(phMeasured) || !isFinitePh(phSetpoint)) return 'none';
  if (Math.abs(phMeasured - phSetpoint) <= tolerancePh) return 'none';
  return phMeasured < phSetpoint ? 'base' : 'acid';
}

export interface ResolveActiveKInput {
  direction: PhCorrectionDirection;
  kAcid: number | null;
  kBase: number | null;
  phSetpoint: number;
  mlPerPhUnit: number;
}

export interface ActiveKResult {
  k: number;
  source: 'learned' | 'seed';
}

/** k aprendido (k_acid/k_base) se disponível; senão seed da calibragem. */
export function resolveActiveK(input: ResolveActiveKInput): ActiveKResult | null {
  const { direction, kAcid, kBase, phSetpoint, mlPerPhUnit } = input;
  if (direction === 'none') return null;

  const learned =
    direction === 'base'
      ? kBase != null && Number.isFinite(kBase) && kBase > K_MIN
        ? kBase
        : null
      : kAcid != null && Number.isFinite(kAcid) && kAcid > K_MIN
        ? kAcid
        : null;

  if (learned != null) {
    return { k: learned, source: 'learned' };
  }

  const seed = seedKFromMlPerPhUnit(phSetpoint, mlPerPhUnit);
  if (seed <= 0) return null;
  return { k: seed, source: 'seed' };
}

/**
 * Preview operador (domínio pH): u(t) = A × V × s_L × |e| = A × |e| × s  (ml)
 * s = ml por unidade pH total (V × s_L).
 */
export function previewPhDoseOperatorMl(
  phSetpoint: number,
  phMeasured: number,
  aggressiveness: number,
  mlPerPhUnitSens: number,
  tolerancePh: number
): number | null {
  if (!isFinitePh(phMeasured) || !isFinitePh(phSetpoint)) return null;
  const e = phErrorAbs(phSetpoint, phMeasured);
  if (e <= tolerancePh) return null;
  if (!Number.isFinite(mlPerPhUnitSens) || mlPerPhUnitSens <= 0) return null;
  const a = Math.min(1, Math.max(0.05, aggressiveness));
  const dose = a * e * mlPerPhUnitSens;
  return Number.isFinite(dose) && dose > 0 ? dose : null;
}

/** u(t) = A × |e_H| / k (ml) — preview firmware (domínio H⁺, detalhe técnico). */
export function previewPhDoseFirmwareMl(
  phSetpoint: number,
  phMeasured: number,
  aggressiveness: number,
  k: number
): number | null {
  if (k <= 0) return null;
  const errH = Math.abs(phErrorH(phSetpoint, phMeasured));
  const a = Math.min(1, Math.max(0.05, aggressiveness));
  const dose = a * (errH / k);
  return Number.isFinite(dose) && dose > 0 ? dose : null;
}

/** ErroH acima disso indica leitura pH extrema (ex.: pH≈0 com SP~6 → ErroH≈1). */
export const PH_EXTREME_ERROR_H_THRESHOLD = 1e-3;

export function isExtremePhErrorH(errorHAbs: number | null): boolean {
  return errorHAbs != null && errorHAbs > PH_EXTREME_ERROR_H_THRESHOLD;
}

/** Espelha AdaptivePHController::planDose — teto max_dose_ml_per_cycle no firmware. */
export function capFirmwarePreviewDose(
  uncappedMl: number | null,
  maxDoseMlPerCycle: number
): number | null {
  if (uncappedMl == null || uncappedMl <= 0) return null;
  const cap = maxDoseMlPerCycle > 0 ? maxDoseMlPerCycle : 50;
  return Math.min(uncappedMl, cap);
}

export function formatExtremePhErrorHWarning(errorHAbs: number): string {
  return `ErroH = ${errorHAbs.toExponential(1)} é atípico (erro pH muito grande ou leitura inválida, ex. pH≈0). A fórmula H⁺ amplifica o valor; o ESP32 limita a dose real a max_dose_ml_per_cycle.`;
}

/** @deprecated Use previewPhDoseFirmwareMl — alias legado. */
export const previewPhDoseMl = previewPhDoseFirmwareMl;

export interface PvStatusMessage {
  message: string;
  variant: 'waiting' | 'invalid';
}

/** Mensagem quando ainda não há leitura pH (null). */
export function formatPvStatusMessage(params: {
  displayPh: number | null;
}): PvStatusMessage | null {
  if (params.displayPh != null) return null;
  return {
    message:
      'Aguardando primeira leitura pH. Badges de verificação continuam ativos.',
    variant: 'waiting',
  };
}
