import type { ChartData, ChartOptions } from 'chart.js';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { HYDRO_CHART_COLORS } from '@/lib/hydro-chart';
import type { EcControllerMetricRow, PhControllerMetricRow } from '@/lib/controller-metrics';

export const CONTROLLER_METRICS_COLORS = {
  error: { border: '#fbbf24', fill: 'rgba(251, 191, 36, 0.12)' },
  ut: { border: '#22c55e', fill: 'rgba(34, 197, 94, 0.12)' },
  setpoint: { border: 'rgba(52, 211, 153, 0.55)', fill: 'transparent' },
  phError: { border: '#a855f7', fill: 'rgba(168, 85, 247, 0.12)' },
  phUt: { border: '#3b82f6', fill: 'rgba(59, 130, 246, 0.12)' },
} as const;

const CHART_TICK_COLOR = '#bae6fd';
const CHART_GRID_COLOR = '#1e3a5f';

export type ControllerMetricsSummary = {
  tickCount: number;
  appliedCount: number;
  neededCount: number;
  lastError: number | null;
  lastUt: number | null;
  lastSetpoint: number | null;
  lastActual: number | null;
  lastAt: string | null;
};

export type PhMetricsSummary = {
  tickCount: number;
  appliedCount: number;
  neededCount: number;
  lastErrorH: number | null;
  lastUt: number | null;
  lastSetpoint: number | null;
  lastPh: number | null;
  lastAt: string | null;
};

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTooltipTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR');
}

function flagLabel(needed?: boolean, applied?: boolean): string {
  if (applied) return 'Dosagem aplicada';
  if (needed) return 'Ajuste necessário (não dosou)';
  return 'Dentro da banda';
}

export function summarizeEcMetrics(rows: EcControllerMetricRow[]): ControllerMetricsSummary {
  if (rows.length === 0) {
    return {
      tickCount: 0,
      appliedCount: 0,
      neededCount: 0,
      lastError: null,
      lastUt: null,
      lastSetpoint: null,
      lastActual: null,
      lastAt: null,
    };
  }
  const last = rows[rows.length - 1];
  return {
    tickCount: rows.length,
    appliedCount: rows.filter((r) => r.adjustment_applied).length,
    neededCount: rows.filter((r) => r.adjustment_needed).length,
    lastError: last.ec_error,
    lastUt: last.dosage_ml,
    lastSetpoint: last.ec_setpoint,
    lastActual: last.ec_actual,
    lastAt: last.created_at,
  };
}

export function summarizePhMetrics(rows: PhControllerMetricRow[]): PhMetricsSummary {
  if (rows.length === 0) {
    return {
      tickCount: 0,
      appliedCount: 0,
      neededCount: 0,
      lastErrorH: null,
      lastUt: null,
      lastSetpoint: null,
      lastPh: null,
      lastAt: null,
    };
  }
  const last = rows[rows.length - 1];
  return {
    tickCount: rows.length,
    appliedCount: rows.filter((r) => r.adjustment_applied).length,
    neededCount: rows.filter((r) => r.adjustment_needed).length,
    lastErrorH: last.error_h ?? null,
    lastUt: last.dose_real_ml,
    lastSetpoint: last.ph_setpoint,
    lastPh: last.ph_before,
    lastAt: last.created_at,
  };
}

export function buildEcMetricsChartData(rows: EcControllerMetricRow[]): ChartData<'line'> {
  const labels = rows.map((r) => formatTimeLabel(r.created_at));
  const ecColor = HYDRO_CHART_COLORS.ec;

  return {
    labels,
    datasets: [
      {
        label: 'EC medida',
        data: rows.map((r) => r.ec_actual),
        yAxisID: 'yEc',
        borderColor: ecColor.border,
        backgroundColor: ecColor.fill,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: 'Setpoint',
        data: rows.map((r) => r.ec_setpoint),
        yAxisID: 'yEc',
        borderColor: CONTROLLER_METRICS_COLORS.setpoint.border,
        backgroundColor: CONTROLLER_METRICS_COLORS.setpoint.fill,
        borderDash: [6, 4],
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: 'Erro (µS/cm)',
        data: rows.map((r) => r.ec_error),
        yAxisID: 'yError',
        borderColor: CONTROLLER_METRICS_COLORS.error.border,
        backgroundColor: CONTROLLER_METRICS_COLORS.error.fill,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: 'u(t) ml',
        data: rows.map((r) => r.dosage_ml),
        yAxisID: 'yUt',
        borderColor: CONTROLLER_METRICS_COLORS.ut.border,
        backgroundColor: CONTROLLER_METRICS_COLORS.ut.fill,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
}

export function buildPhMetricsChartData(rows: PhControllerMetricRow[]): ChartData<'line'> {
  const labels = rows.map((r) => formatTimeLabel(r.created_at));
  const phColor = HYDRO_CHART_COLORS.ph;

  return {
    labels,
    datasets: [
      {
        label: 'pH medido',
        data: rows.map((r) => r.ph_before),
        yAxisID: 'yPh',
        borderColor: phColor.border,
        backgroundColor: phColor.fill,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: 'Setpoint',
        data: rows.map((r) => r.ph_setpoint),
        yAxisID: 'yPh',
        borderColor: 'rgba(167, 139, 250, 0.5)',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
      },
      {
        label: 'error_h',
        data: rows.map((r) => r.error_h ?? 0),
        yAxisID: 'yError',
        borderColor: CONTROLLER_METRICS_COLORS.phError.border,
        backgroundColor: CONTROLLER_METRICS_COLORS.phError.fill,
        tension: 0.25,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: 'u(t) ml',
        data: rows.map((r) => r.dose_real_ml),
        yAxisID: 'yUt',
        borderColor: CONTROLLER_METRICS_COLORS.phUt.border,
        backgroundColor: CONTROLLER_METRICS_COLORS.phUt.fill,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
}

function baseChartOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 10, font: { size: 11 }, color: CHART_TICK_COLOR },
      },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 8, font: { size: 10 }, color: CHART_TICK_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
    },
  };
}

export function buildEcMetricsChartOptions(rows: EcControllerMetricRow[]): ChartOptions<'line'> {
  const base = baseChartOptions();
  return {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const row = rows[idx];
            return row ? formatTooltipTimestamp(row.created_at) : '';
          },
          afterBody: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const row = rows[idx];
            if (!row) return [];
            return [
              flagLabel(row.adjustment_needed, row.adjustment_applied),
              row.dosage_time_seconds != null
                ? `Tempo: ${formatSensorValue(row.dosage_time_seconds, 1)} s`
                : '',
            ].filter(Boolean);
          },
        },
      },
    },
    scales: {
      ...base.scales,
      yEc: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'EC µS/cm', color: CHART_TICK_COLOR, font: { size: 10 } },
        ticks: { color: CHART_TICK_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
      yError: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Erro', color: CHART_TICK_COLOR, font: { size: 10 } },
        ticks: { color: CHART_TICK_COLOR },
        grid: { drawOnChartArea: false },
      },
      yUt: {
        type: 'linear',
        display: false,
        position: 'right',
        grid: { drawOnChartArea: false },
      },
    },
  };
}

export function buildPhMetricsChartOptions(rows: PhControllerMetricRow[]): ChartOptions<'line'> {
  const base = baseChartOptions();
  return {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const row = rows[idx];
            return row ? formatTooltipTimestamp(row.created_at) : '';
          },
          afterBody: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const row = rows[idx];
            if (!row) return [];
            return [flagLabel(row.adjustment_needed, row.adjustment_applied)].filter(Boolean);
          },
        },
      },
    },
    scales: {
      ...base.scales,
      yPh: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        max: 14,
        title: { display: true, text: 'pH', color: CHART_TICK_COLOR, font: { size: 10 } },
        ticks: { color: CHART_TICK_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
      yError: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'error_h', color: CHART_TICK_COLOR, font: { size: 10 } },
        ticks: { color: CHART_TICK_COLOR },
        grid: { drawOnChartArea: false },
      },
      yUt: {
        type: 'linear',
        display: false,
        position: 'right',
        grid: { drawOnChartArea: false },
      },
    },
  };
}

/** Serie demo para UI local (Gate V3/V4 sin flash). */
export function buildMockEcMetrics(deviceId: string, points = 36): EcControllerMetricRow[] {
  const setpoint = 800;
  const now = Date.now();
  const intervalMs = 10 * 60 * 1000;
  const rows: EcControllerMetricRow[] = [];

  for (let i = 0; i < points; i++) {
    const t = now - (points - 1 - i) * intervalMs;
    const progress = i / Math.max(points - 1, 1);
    const ecActual = setpoint - 220 * (1 - progress) + Math.sin(i / 3) * 15;
    const error = Math.max(0, setpoint - ecActual);
    const needed = error > 40;
    const applied = needed && i % 5 === 4;
    const dosage = applied ? Math.min(8, error * 0.02) : needed ? Math.min(6, error * 0.015) : 0;

    rows.push({
      device_id: deviceId,
      ec_setpoint: setpoint,
      ec_actual: Math.round(ecActual * 10) / 10,
      ec_error: Math.round(error * 10) / 10,
      dosage_ml: Math.round(dosage * 1000) / 1000,
      dosage_time_seconds: applied ? dosage / 0.5 : 0,
      adjustment_needed: needed,
      adjustment_applied: applied,
      created_at: new Date(t).toISOString(),
    });
  }
  return rows;
}

export function buildMockPhMetrics(deviceId: string, points = 36): PhControllerMetricRow[] {
  const setpoint = 6.2;
  const now = Date.now();
  const intervalMs = 10 * 60 * 1000;
  const rows: PhControllerMetricRow[] = [];

  for (let i = 0; i < points; i++) {
    const t = now - (points - 1 - i) * intervalMs;
    const progress = i / Math.max(points - 1, 1);
    const ph = setpoint - 0.35 * (1 - progress) + Math.sin(i / 4) * 0.05;
    const errorH = Math.max(0, setpoint - ph) * 1e-5;
    const needed = ph < setpoint - 0.08;
    const applied = needed && i % 6 === 5;
    const dose = applied ? 2.5 : needed ? 1.8 : 0;

    rows.push({
      device_id: deviceId,
      ph_setpoint: setpoint,
      ph_before: Math.round(ph * 1000) / 1000,
      error_h: errorH,
      dose_real_ml: dose,
      adjustment_needed: needed,
      adjustment_applied: applied,
      created_at: new Date(t).toISOString(),
    });
  }
  return rows;
}
