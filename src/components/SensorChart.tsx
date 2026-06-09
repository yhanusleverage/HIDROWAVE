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
  const defaultOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#bae6fd',
        },
      },
      title: {
        display: true,
        text: title,
        color: '#e0f2fe',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#152547',
        titleColor: '#e0f2fe',
        bodyColor: '#bae6fd',
        borderColor: '#1e3a5f',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          color: '#bae6fd',
        },
        grid: {
          color: '#1e3a5f',
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: '#bae6fd',
        },
        grid: {
          color: '#1e3a5f',
        },
      }
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  return (
    <div style={{ height: `${height}px` }} className="bg-dark-card border border-dark-border p-4 rounded-lg shadow-lg">
      <Line data={data} options={mergedOptions} />
    </div>
  );
} 