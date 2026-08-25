/**
 * Verificación rápida de series métricas — ejecutar con:
 * npx tsx scripts/verify-controller-metrics-chart.ts
 */
import {
  buildEcMetricsChartData,
  buildMockEcMetrics,
  buildMockPhMetrics,
  buildPhMetricsChartData,
  summarizeEcMetrics,
  summarizePhMetrics,
} from '../src/lib/controller-metrics-chart';

const deviceId = 'ESP32_HIDRO_269844';

const ecRows = buildMockEcMetrics(deviceId, 12);
const phRows = buildMockPhMetrics(deviceId, 12);

const ecSummary = summarizeEcMetrics(ecRows);
const phSummary = summarizePhMetrics(phRows);

const ecChart = buildEcMetricsChartData(ecRows);
const phChart = buildPhMetricsChartData(phRows);

console.log('EC summary:', ecSummary);
console.log('pH summary:', phSummary);
console.log('EC datasets:', ecChart.datasets.map((d) => d.label));
console.log('pH datasets:', phChart.datasets.map((d) => d.label));

if (ecChart.labels.length !== 12) {
  console.error('FAIL: EC labels count');
  process.exit(1);
}

if (phChart.labels.length !== 12) {
  console.error('FAIL: pH labels count');
  process.exit(1);
}

if (ecSummary.tickCount !== 12 || ecSummary.appliedCount < 1) {
  console.error('FAIL: EC summary incoherente');
  process.exit(1);
}

if (phSummary.tickCount !== 12) {
  console.error('FAIL: pH summary incoherente');
  process.exit(1);
}

const phErrorDs = phChart.datasets.find((d) => d.label === 'Erro (pH)');
if (!phErrorDs) {
  console.error('FAIL: pH chart deve exibir Erro (pH), não error_h');
  process.exit(1);
}

const lastPh = phRows[phRows.length - 1];
const expectedPhError = lastPh.ph_before - lastPh.ph_setpoint;
if (phSummary.lastError == null || Math.abs(phSummary.lastError - expectedPhError) > 1e-9) {
  console.error('FAIL: lastError pH deve ser pH − SP');
  process.exit(1);
}

const lastEcError = ecRows[ecRows.length - 1].ec_error;
if (lastEcError > ecRows[0].ec_error) {
  console.error('FAIL: demo EC debería reducir error hacia el final');
  process.exit(1);
}

console.log('\nOK controller metrics chart');
