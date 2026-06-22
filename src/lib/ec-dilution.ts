/**
 * Diluição EC modo A — fórmulas espelhadas em EcDilutionController.cpp (firmware).
 */

export function needsDilution(
  sp: number,
  ec: number,
  tolerance: number
): boolean {
  if (!Number.isFinite(sp) || !Number.isFinite(ec) || sp <= 0 || ec <= 0) {
    return false;
  }
  return ec - sp > tolerance;
}

/** V_agua = V_tanque × (1 − SP/EC) */
export function calcDrainVolumeL(
  sp: number,
  ec: number,
  tankVolumeL: number
): number {
  if (
    tankVolumeL <= 0 ||
    ec <= sp ||
    sp <= 0 ||
    ec <= 0 ||
    !Number.isFinite(sp) ||
    !Number.isFinite(ec)
  ) {
    return 0;
  }
  const fraction = 1 - sp / ec;
  if (fraction <= 0) return 0;
  return tankVolumeL * fraction;
}

export function calcReplaceFraction(sp: number, ec: number): number {
  if (ec <= 0 || sp <= 0 || ec <= sp) return 0;
  return 1 - sp / ec;
}

/** Erro firmado SP − EC (negativo = overshoot) */
export function calcSignedErrorUs(sp: number, ec: number): number {
  if (!Number.isFinite(sp) || !Number.isFinite(ec)) return 0;
  return sp - ec;
}

export function calcRelativeExcess(sp: number, ec: number): number {
  if (sp <= 0 || ec <= sp) return 0;
  return ec / sp - 1;
}

export function clampDilutionVolume(
  volumeL: number,
  maxVolumeL: number
): number {
  if (!Number.isFinite(volumeL) || volumeL <= 0) return 0;
  if (!Number.isFinite(maxVolumeL) || maxVolumeL <= 0) return volumeL;
  return Math.min(volumeL, maxVolumeL);
}
