'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  fetchEcControllerMetrics,
  fetchPhControllerMetrics,
  formatMetricTime,
  type EcControllerMetricRow,
  type PhControllerMetricRow,
} from '@/lib/controller-metrics';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const CHART_HEIGHT = 220;

type ControllerMetricsChartProps = {
  deviceId: string;
  className?: string;
};

export default function ControllerMetricsChart({
  deviceId,
  className = '',
}: ControllerMetricsChartProps) {
  const [ecRows, setEcRows] = useState<EcControllerMetricRow[]>([]);
  const [phRows, setPhRows] = useState<PhControllerMetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [ec, ph] = await Promise.all([
        fetchEcControllerMetrics(deviceId),
        fetchPhControllerMetrics(deviceId),
      ]);
      if (!cancelled) {
        setEcRows(ec);
        setPhRows(ph);
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [deviceId]);

  const ecChart = useMemo(() => {
    const labels = ecRows.map((r) => formatMetricTime(r.created_at));
    return {
      labels,
      datasets: [
        {
          label: 'Erro EC (µS/cm)',
          data: ecRows.map((r) => r.ec_error),
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          yAxisID: 'y',
          tension: 0.2,
          pointRadius: 2,
        },
        {
          label: 'u(t) ml',
          data: ecRows.map((r) => r.dosage_ml),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          yAxisID: 'y1',
          tension: 0.2,
          pointRadius: 2,
        },
      ],
    };
  }, [ecRows]);

  const phChart = useMemo(() => {
    const labels = phRows.map((r) => formatMetricTime(r.created_at));
    return {
      labels,
      datasets: [
        {
          label: 'error_h',
          data: phRows.map((r) => r.error_h ?? 0),
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          yAxisID: 'y',
          tension: 0.2,
          pointRadius: 2,
        },
        {
          label: 'u(t) ml',
          data: phRows.map((r) => r.dose_real_ml),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          yAxisID: 'y1',
          tension: 0.2,
          pointRadius: 2,
        },
      ],
    };
  }, [phRows]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } },
      y: { type: 'linear' as const, display: true, position: 'left' as const },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
      },
    },
  };

  const hasData = ecRows.length > 0 || phRows.length > 0;

  return (
    <InstrumentCard
      accent="brand"
      className={className}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Métricas de ciclo Auto EC / pH</span>
          <span className="text-xs font-normal text-dark-textSecondary">últimas 24 h</span>
        </div>
      }
    >
      {loading && !hasData ? (
        <p className="text-center text-xs text-dark-textSecondary py-8">Carregando métricas…</p>
      ) : !hasData ? (
        <p className="text-center text-xs text-dark-textSecondary py-8">
          Sem métricas ainda — ative Auto EC/pH com sensor válido (após SQL + flash).
        </p>
      ) : (
        <div className="space-y-6">
          {ecRows.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-dark-textSecondary">Auto EC</p>
              <div style={{ height: CHART_HEIGHT }} className="relative w-full">
                <Line data={ecChart} options={chartOptions} />
              </div>
            </div>
          )}
          {phRows.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-dark-textSecondary">Auto pH</p>
              <div style={{ height: CHART_HEIGHT }} className="relative w-full">
                <Line data={phChart} options={chartOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </InstrumentCard>
  );
}
