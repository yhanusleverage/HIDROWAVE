/**
 * Verificación FIFO — appendMetricRow / trimMetricsRows
 * npx tsx scripts/verify-controller-metrics-fifo.ts
 */
import {
  appendMetricRow,
  METRICS_MAX_ROWS,
  sortMetricsByTime,
  trimMetricsRows,
} from '../src/lib/controller-metrics-fifo';

type EcControllerMetricRow = {
  id?: number;
  device_id: string;
  ec_setpoint: number;
  ec_actual: number;
  ec_error: number;
  dosage_ml: number;
  created_at: string;
};

function makeRow(id: number, offsetMs: number): EcControllerMetricRow {
  return {
    id,
    device_id: 'ESP32_HIDRO_269844',
    ec_setpoint: 800,
    ec_actual: 600,
    ec_error: 200,
    dosage_ml: 0,
    created_at: new Date(Date.now() - offsetMs).toISOString(),
  };
}

// Caso 1: 121 filas → FIFO conserva 120, la más antigua sale
{
  const rows: EcControllerMetricRow[] = [];
  for (let i = 0; i < 121; i++) {
    rows.push(makeRow(i + 1, (120 - i) * 60_000));
  }
  const trimmed = trimMetricsRows(rows);
  if (trimmed.length !== METRICS_MAX_ROWS) {
    console.error(`FAIL: esperado ${METRICS_MAX_ROWS} filas, got ${trimmed.length}`);
    process.exit(1);
  }
  if (trimmed[0].id !== 2) {
    console.error(`FAIL: fila más antigua debería ser id=2, got id=${trimmed[0].id}`);
    process.exit(1);
  }
  if (trimmed[trimmed.length - 1].id !== 121) {
    console.error(`FAIL: fila más nueva debería ser id=121, got id=${trimmed[trimmed.length - 1].id}`);
    process.exit(1);
  }
  console.log('OK caso 1: 121 filas → FIFO 120, id=1 eliminado');
}

// Caso 2: mismo created_at, id distinto → ambas entran
{
  const iso = new Date().toISOString();
  const a = makeRow(10, 0);
  const b = makeRow(11, 0);
  a.created_at = iso;
  b.created_at = iso;
  const result = appendMetricRow([a], b);
  if (result.length !== 2) {
    console.error(`FAIL: mismo timestamp con ids distintos debería dar 2 filas, got ${result.length}`);
    process.exit(1);
  }
  console.log('OK caso 2: mismo created_at, ids distintos → ambas filas');
}

// Caso 3: dedup por id
{
  const row = makeRow(99, 0);
  const result = appendMetricRow([row], { ...row });
  if (result.length !== 1) {
    console.error(`FAIL: dedup por id debería mantener 1 fila, got ${result.length}`);
    process.exit(1);
  }
  console.log('OK caso 3: dedup por id');
}

// Caso 4: append incremental FIFO
{
  let buf: EcControllerMetricRow[] = [];
  for (let i = 1; i <= 125; i++) {
    buf = appendMetricRow(buf, makeRow(i, (125 - i) * 30_000));
  }
  if (buf.length !== METRICS_MAX_ROWS) {
    console.error(`FAIL: append incremental length ${buf.length}`);
    process.exit(1);
  }
  if (buf[0].id !== 6) {
    console.error(`FAIL: append incremental oldest id=${buf[0].id}, expected 6`);
    process.exit(1);
  }
  if (buf[buf.length - 1].id !== 125) {
    console.error(`FAIL: append incremental newest id=${buf[buf.length - 1].id}, expected 125`);
    process.exit(1);
  }
  console.log('OK caso 4: append incremental FIFO');
}

// Caso 5: sortMetricsByTime
{
  const unsorted = [makeRow(3, 60_000), makeRow(1, 180_000), makeRow(2, 120_000)];
  const sorted = sortMetricsByTime(unsorted);
  if (sorted.map((r) => r.id).join(',') !== '1,2,3') {
    console.error('FAIL: sortMetricsByTime orden incorrecto');
    process.exit(1);
  }
  console.log('OK caso 5: sortMetricsByTime');
}

console.log('\nOK controller metrics FIFO');
