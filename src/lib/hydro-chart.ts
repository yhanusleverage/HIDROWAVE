import type { ChartData, ChartOptions, Plugin } from 'chart.js';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { resolveEcForDisplay } from '@/lib/realtime/hydro-ec';
import { resolvePhForDisplay } from '@/lib/realtime/hydro-ph';
import type { HydroMeasurement } from '@/lib/supabase';

/** Colores de dominio — alinhados a globals.css (--hw-domain-*). */
export const HYDRO_CHART_COLORS = {
  ph: { border: '#a78bfa', fill: 'rgba(167, 139, 250, 0.2)' },
  ec: { border: '#34d399', fill: 'rgba(52, 211, 153, 0.2)' },
  temp: { border: '#26c6da', fill: 'rgba(38, 198, 218, 0.2)' },
} as const;

const TEMP_CHART_MIN = -5;
const TEMP_CHART_MAX = 60;
const PH_CHART_MIN = 0;
const PH_CHART_MAX = 14;

function validSeriesNumbers(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v));
}

function computeAxisBounds(
  values: (number | null)[],
  opts: {
    padding: number;
    minLimit?: number;
    maxLimit?: number;
    defaultMin: number;
    defaultMax: number;
  }
): { min: number; max: number } {
  const valid = validSeriesNumbers(values);
  if (valid.length === 0) {
    return { min: opts.defaultMin, max: opts.defaultMax };
  }

  let min = Math.min(...valid);
  let max = Math.max(...valid);
  const span = max - min;
  const pad = span < 0.001 ? opts.padding : Math.max(opts.padding, span * 0.25);
  min -= pad;
  max += pad;

  if (opts.minLimit != null) min = Math.max(opts.minLimit, min);
  if (opts.maxLimit != null) max = Math.min(opts.maxLimit, max);

  if (min >= max) {
    return { min: opts.defaultMin, max: opts.defaultMax };
  }
  return { min, max };
}

/** pH para gráfico — alinhado às cards; rejeita lixo de sensor (≈0, >14). */
function resolvePhForChart(row: { ph?: number | null } | null | undefined): number | null {
  const ph = resolvePhForDisplay(row);
  if (ph == null) return null;
  if (Math.abs(ph) < 0.01) return null;
  if (ph > PH_CHART_MAX) return null;
  return ph;
}

function resolveTempForChart(temp: number | null | undefined): number | null {
  if (temp === null || temp === undefined) return null;
  const n = Number(temp);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  if (n < TEMP_CHART_MIN || n > TEMP_CHART_MAX) return null;
  return n;
}

export type HydroParamKey = 'ph' | 'ec' | 'temp';

export const HYDRO_PARAM_META: Record<
  HydroParamKey,
  { label: string; unit: string; decimals: number; color: (typeof HYDRO_CHART_COLORS)[HydroParamKey] }
> = {
  ph: { label: 'pH', unit: '', decimals: 2, color: HYDRO_CHART_COLORS.ph },
  ec: { label: 'EC', unit: 'µS/cm', decimals: 0, color: HYDRO_CHART_COLORS.ec },
  temp: { label: 'Temp', unit: '°C', decimals: 1, color: HYDRO_CHART_COLORS.temp },
};

export type HydroChartSeries = {
  labels: string[];
  timestamps: string[];
  ph: (number | null)[];
  ec: (number | null)[];
  temp: (number | null)[];
};

export type HydroChartThresholds = {
  phMin?: number;
  phMax?: number;
  ecWarningMin?: number;
  ecWarningMax?: number;
  ecDangerMin?: number;
  ecDangerMax?: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep merge para opciones Chart.js — evita perder plugins/scales del default. */
export function deepMergeChartOptions<T extends Record<string, unknown>>(
  base: T,
  override?: Partial<T>
): T {
  if (!override) return { ...base };
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = base[key];
    const overVal = override[key];
    if (isPlainObject(baseVal) && isPlainObject(overVal as unknown)) {
      result[key] = deepMergeChartOptions(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (overVal !== undefined) {
      result[key] = overVal as T[keyof T];
    }
  }
  return result;
}

function formatTimeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Construye series QC a partir del histórico (más reciente primero).
 * Invierte a orden cronológico: antiguo (izq) → reciente (der).
 */
export function buildHydroChartSeries(history: HydroMeasurement[]): HydroChartSeries {
  const chronological = [...history].reverse();
  const labels: string[] = [];
  const timestamps: string[] = [];
  const ph: (number | null)[] = [];
  const ec: (number | null)[] = [];
  const temp: (number | null)[] = [];

  for (const item of chronological) {
    const ts = item.created_at ?? '';
    timestamps.push(ts);
    labels.push(ts ? formatTimeLabel(ts) : '--');
    ph.push(resolvePhForChart(item));
    ec.push(resolveEcForDisplay(item));
    temp.push(resolveTempForChart(item.temperature));
  }

  return { labels, timestamps, ph, ec, temp };
}

export function getSeriesValues(series: HydroChartSeries, param: HydroParamKey): (number | null)[] {
  return series[param];
}

export function formatHydroChartTimestamp(label: string, timestamp?: string): string {
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('pt-BR');
    }
  }
  return label;
}

export function formatHydroTooltipLine(
  param: HydroParamKey,
  value: number | null | undefined
): string {
  const meta = HYDRO_PARAM_META[param];
  const formatted =
    value == null || Number.isNaN(value) ? '--' : formatSensorValue(value, meta.decimals);
  const unitSuffix = formatted === '--' || !meta.unit ? '' : ` ${meta.unit}`;
  return `${meta.label}: ${formatted}${unitSuffix}`;
}

const CHART_TICK_COLOR = '#bae6fd';
const CHART_GRID_COLOR = '#1e3a5f';

/** Línea vertical en el índice activo — sincronizada entre paneles vía setActiveElements. */
export const hydroCrosshairPlugin: Plugin<'line'> = {
  id: 'hydroCrosshair',
  afterDraw(chart) {
    const active = chart.getActiveElements();
    if (active.length === 0) return;

    const element = active[0].element;
    if (!element || typeof element.x !== 'number') return;

    const { top, bottom, left, right } = chart.chartArea;
    const x = element.x;
    if (x < left || x > right) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.strokeStyle = 'rgba(38, 198, 218, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
};

export function buildHydroCombinedChartData(series: HydroChartSeries): ChartData<'line'> {
  const phMeta = HYDRO_PARAM_META.ph;
  const ecMeta = HYDRO_PARAM_META.ec;
  const tempMeta = HYDRO_PARAM_META.temp;

  return {
    labels: series.labels,
    datasets: [
      {
        label: 'pH',
        data: series.ph,
        yAxisID: 'y',
        borderColor: phMeta.color.border,
        backgroundColor: phMeta.color.fill,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: phMeta.color.border,
        pointHoverBorderColor: '#e0f2fe',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      },
      {
        label: 'EC (µS/cm)',
        data: series.ec,
        yAxisID: 'y1',
        borderColor: ecMeta.color.border,
        backgroundColor: ecMeta.color.fill,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: ecMeta.color.border,
        pointHoverBorderColor: '#e0f2fe',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      },
      {
        label: 'Temperatura da Água (°C)',
        data: series.temp,
        yAxisID: 'yTemp',
        borderColor: tempMeta.color.border,
        backgroundColor: tempMeta.color.fill,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: tempMeta.color.border,
        pointHoverBorderColor: '#e0f2fe',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  };
}

const COMBINED_PARAM_BY_DATASET: HydroParamKey[] = ['ph', 'ec', 'temp'];

/** Gráfico único — pH + Temp à esquerda; EC à direita; escalas dinâmicas. */
export function buildHydroCombinedChartOptions(series: HydroChartSeries): ChartOptions<'line'> {
  const phBounds = computeAxisBounds(series.ph, {
    padding: 0.3,
    minLimit: PH_CHART_MIN,
    maxLimit: PH_CHART_MAX,
    defaultMin: 4,
    defaultMax: 9,
  });
  const tempBounds = computeAxisBounds(series.temp, {
    padding: 1.5,
    minLimit: TEMP_CHART_MIN,
    maxLimit: TEMP_CHART_MAX,
    defaultMin: 15,
    defaultMax: 35,
  });
  const ecValues = validSeriesNumbers(series.ec);
  const ecBounds =
    ecValues.length > 0
      ? computeAxisBounds(series.ec, {
          padding: 50,
          minLimit: 0,
          defaultMin: 0,
          defaultMax: 1000,
        })
      : { min: 0, max: 1000 };

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: CHART_TICK_COLOR,
          usePointStyle: true,
          padding: 16,
        },
      },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#152547',
        titleColor: '#e0f2fe',
        bodyColor: CHART_TICK_COLOR,
        borderColor: CHART_GRID_COLOR,
        borderWidth: 1,
        filter: () => true,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx == null) return '';
            return formatHydroChartTimestamp(series.labels[idx] ?? '', series.timestamps[idx]);
          },
          label: (ctx) => {
            const param = COMBINED_PARAM_BY_DATASET[ctx.datasetIndex] ?? 'ph';
            const raw = ctx.parsed.y;
            const value = raw == null || Number.isNaN(raw) ? null : raw;
            return formatHydroTooltipLine(param, value);
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: CHART_TICK_COLOR,
          autoSkip: true,
          maxTicksLimit: 12,
        },
        grid: { color: CHART_GRID_COLOR },
      },
      y: {
        type: 'linear',
        position: 'left',
        min: phBounds.min,
        max: phBounds.max,
        title: {
          display: true,
          text: 'pH',
          color: HYDRO_CHART_COLORS.ph.border,
        },
        ticks: {
          color: HYDRO_CHART_COLORS.ph.border,
          maxTicksLimit: 8,
        },
        grid: { color: CHART_GRID_COLOR },
      },
      yTemp: {
        type: 'linear',
        position: 'left',
        min: tempBounds.min,
        max: tempBounds.max,
        title: {
          display: true,
          text: 'Temperatura (°C)',
          color: HYDRO_CHART_COLORS.temp.border,
        },
        ticks: {
          color: HYDRO_CHART_COLORS.temp.border,
          maxTicksLimit: 8,
        },
        grid: { drawOnChartArea: false },
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: ecBounds.min,
        max: ecBounds.max,
        title: {
          display: true,
          text: 'EC (µS/cm)',
          color: HYDRO_CHART_COLORS.ec.border,
        },
        ticks: { color: HYDRO_CHART_COLORS.ec.border },
        grid: { drawOnChartArea: false },
      },
    },
  };
}

export function buildHydroPanelData(
  param: HydroParamKey,
  series: HydroChartSeries
): ChartData<'line'> {
  const meta = HYDRO_PARAM_META[param];
  const data = getSeriesValues(series, param);

  return {
    labels: series.labels,
    datasets: [
      {
        label: meta.label,
        data,
        borderColor: meta.color.border,
        backgroundColor: meta.color.fill,
        tension: 0.3,
        spanGaps: false,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: meta.color.border,
        pointHoverBorderColor: '#e0f2fe',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  };
}

export function buildHydroPanelOptions(
  param: HydroParamKey,
  options: {
    showXAxis?: boolean;
    onHover?: ChartOptions<'line'>['onHover'];
  } = {}
): ChartOptions<'line'> {
  const meta = HYDRO_PARAM_META[param];
  const yAxisTitle =
    param === 'ec' ? 'EC µS/cm' : param === 'ph' ? 'pH' : 'Temp °C';

  const yScale: NonNullable<ChartOptions<'line'>['scales']>['y'] = {
    beginAtZero: false,
    ticks: { color: CHART_TICK_COLOR },
    grid: { color: CHART_GRID_COLOR },
    title: {
      display: true,
      text: yAxisTitle,
      color: meta.color.border,
      font: { size: 11 },
    },
  };

  if (param === 'ph') {
    yScale.min = 4;
    yScale.max = 9;
    yScale.ticks = { ...yScale.ticks, stepSize: 0.5 };
  } else if (param === 'temp') {
    yScale.min = 15;
    yScale.max = 35;
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        display: options.showXAxis ?? false,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: CHART_TICK_COLOR,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        grid: { color: CHART_GRID_COLOR },
      },
      y: yScale,
    },
    onHover: options.onHover,
  };
}

/** Opciones base compartidas para SensorChart (tema escuro HydroWave). */
export function hydroChartBaseOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: CHART_TICK_COLOR },
      },
      title: {
        display: true,
        color: '#e0f2fe',
        font: { size: 16, weight: 'bold' },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#152547',
        titleColor: '#e0f2fe',
        bodyColor: CHART_TICK_COLOR,
        borderColor: CHART_GRID_COLOR,
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { color: CHART_TICK_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
      x: {
        ticks: { maxRotation: 45, minRotation: 45, color: CHART_TICK_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
    },
  };
}
