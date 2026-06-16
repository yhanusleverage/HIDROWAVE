import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { deepMergeChartOptions, hydroChartBaseOptions } from '@/lib/hydro-chart';

export { deepMergeChartOptions } from '@/lib/hydro-chart';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type SensorChartProps = {
  title: string;
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  height?: number;
};

export default function SensorChart({ title, data, options, height = 250 }: SensorChartProps) {
  const defaultOptions = hydroChartBaseOptions();
  defaultOptions.plugins = deepMergeChartOptions(
    defaultOptions.plugins ?? {},
    {
      title: {
        display: true,
        text: title,
        color: '#e0f2fe',
        font: { size: 16, weight: 'bold' },
      },
    }
  );

  const mergedOptions = deepMergeChartOptions(
    defaultOptions as Record<string, unknown>,
    (options ?? {}) as Record<string, unknown>
  ) as ChartOptions<'line'>;

  return (
    <div style={{ height: `${height}px` }} className="bg-dark-card border border-dark-border p-4 rounded-lg shadow-lg">
      <Line data={data} options={mergedOptions} />
    </div>
  );
} 