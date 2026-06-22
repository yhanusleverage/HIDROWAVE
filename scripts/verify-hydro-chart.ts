/**
 * Verificación rápida de series/tooltip — ejecutar con:
 * npx tsx scripts/verify-hydro-chart.ts
 */
import {
  buildHydroChartSeries,
  formatHydroTooltipLine,
} from '../src/lib/hydro-chart';
import type { HydroMeasurement } from '../src/lib/supabase';

const deviceId = 'ESP32_HIDRO_269844';

function row(
  id: number,
  iso: string,
  ph: number,
  ec: number,
  temp: number
): HydroMeasurement {
  return {
    id,
    device_id: deviceId,
    created_at: iso,
    ph,
    ec,
    temperature: temp,
    water_level_ok: true,
  };
}

// Histórico desc (más reciente primero) — como appendToHistoryDesc
const history: HydroMeasurement[] = [
  row(3, '2026-06-14T15:30:00.000Z', 6.42, 520, 22.1),
  row(2, '2026-06-14T15:25:00.000Z', Number('2e-39'), 480, 21.8),
  row(1, '2026-06-14T15:20:00.000Z', 6.1, NaN as unknown as number, 45),
];

const series = buildHydroChartSeries(history);

console.log('labels (cronológico):', series.labels);
console.log('pH QC:', series.ph);
console.log('EC:', series.ec);
console.log('Temp QC:', series.temp);

if (series.ph[0] !== 6.1 || series.ph[2] !== 6.42) {
  console.error('FAIL: pH válido deveria aparecer no gráfico');
  process.exit(1);
}

const idx = 1;
console.log('\nTooltip índice', idx, '(pH basura → --):');
console.log(formatHydroTooltipLine('ph', series.ph[idx]));
console.log(formatHydroTooltipLine('ec', series.ec[idx]));
console.log(formatHydroTooltipLine('temp', series.temp[idx]));

if (series.ph[idx] !== null) {
  console.error('FAIL: pH basura debería ser null en el gráfico');
  process.exit(1);
}
if (!formatHydroTooltipLine('ph', null).includes('--')) {
  console.error('FAIL: tooltip pH null sin --');
  process.exit(1);
}

const bad = series.ph.some((v) => v !== null && Math.abs(v) < 1e-10);
if (bad) {
  console.error('FAIL: pH basura no filtrado');
  process.exit(1);
}
if (series.labels[0] !== series.labels[0]) {
  // noop
}
if (series.timestamps[0] !== '2026-06-14T15:20:00.000Z') {
  console.error('FAIL: orden cronológico incorrecto');
  process.exit(1);
}
if (series.timestamps[series.timestamps.length - 1] !== '2026-06-14T15:30:00.000Z') {
  console.error('FAIL: punto más reciente debe estar al final');
  process.exit(1);
}

console.log('\nOK: series QC, orden temporal y tooltip con --');
