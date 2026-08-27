import type { Chart, LegendItem, TooltipItem } from 'chart.js';

function seriesLineColor(borderColor: unknown, fallback = '#bae6fd'): string {
  return typeof borderColor === 'string' && borderColor ? borderColor : fallback;
}

/** Recuadros de leyenda rellenos con el color de la línea (no el fill al 20%). */
export function solidLegendSwatches(chart: Chart): LegendItem[] {
  return chart.data.datasets.map((dataset, datasetIndex) => {
    const color = seriesLineColor(dataset.borderColor);
    return {
      text: dataset.label ?? '',
      fillStyle: color,
      strokeStyle: color,
      fontColor: '#ffffff',
      lineWidth: 1,
      hidden: !chart.isDatasetVisible(datasetIndex),
      datasetIndex,
    };
  });
}

export function solidTooltipSwatch(ctx: TooltipItem<'line'>) {
  const color = seriesLineColor(ctx.dataset.borderColor);
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: 0,
  };
}

export const SOLID_LEGEND_LABELS = {
  usePointStyle: false as const,
  boxWidth: 10,
  boxHeight: 10,
  color: '#ffffff',
  generateLabels: solidLegendSwatches,
};
