'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import {
  buildHydroChartSeries,
  buildHydroCombinedChartData,
  buildHydroCombinedChartOptions,
  hydroCrosshairPlugin,
} from '@/lib/hydro-chart';
import type { HydroMeasurement } from '@/lib/supabase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  hydroCrosshairPlugin
);

const CHART_HEIGHT = 280;

type HydroMonitoringChartProps = {
  history: HydroMeasurement[];
  className?: string;
};

export default function HydroMonitoringChart({ history, className = '' }: HydroMonitoringChartProps) {
  const series = useMemo(() => buildHydroChartSeries(history), [history]);

  const chartData = useMemo(() => buildHydroCombinedChartData(series), [series]);
  const chartOptions = useMemo(() => buildHydroCombinedChartOptions(series), [series]);

  return (
    <InstrumentCard
      accent="brand"
      className={className}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Monitoramento hidropónico</span>
          <span className="text-xs font-normal text-dark-textSecondary">
            últimas {series.labels.length || 0} leituras
          </span>
        </div>
      }
    >
      <div style={{ height: CHART_HEIGHT }} className="relative w-full">
        <Line data={chartData} options={chartOptions} />
      </div>

      {series.labels.length === 0 && (
        <p className="mt-2 text-center text-xs text-dark-textSecondary">
          Sem histórico ainda — aguardando leituras do dispositivo.
        </p>
      )}
    </InstrumentCard>
  );
}
