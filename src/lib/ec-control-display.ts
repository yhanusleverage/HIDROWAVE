/** Erro em domínio EC: |EC_medido − SP| (µS/cm). */
export function ecErrorAbs(ecSetpoint: number, ecMeasured: number): number {
  return Math.abs(ecMeasured - ecSetpoint);
}
