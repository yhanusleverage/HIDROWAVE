/** Formata leitura de sensor para UI — sem filtrar intervalo, só evita NaN/null. */
export function formatSensorValue(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined) return '--';
  const n = Number(value);
  if (Number.isNaN(n)) return '--';
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < Math.pow(10, -decimals))) {
    return n.toExponential(2);
  }
  return n.toFixed(decimals);
}
