'use client';

import React from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import HydroMonitoringChart from '@/components/HydroMonitoringChart';
import ControllerMetricsChart from '@/components/ControllerMetricsChart';
import BrandLoading from '@/components/BrandLoading';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HydroMeasurement } from '@/lib/supabase';

export interface DashboardChartsSectionProps {
  loadingCharts: boolean;
  hydroHistory: HydroMeasurement[];
  selectedDeviceId: string;
}

export function DashboardChartsSection({
  loadingCharts,
  hydroHistory,
  selectedDeviceId,
}: DashboardChartsSectionProps) {
  return (
    <section className="mb-8">
      <SectionHeader
        accent="brand"
        title={
          <span className="flex items-center gap-2 text-xl font-bold text-dark-text">
            <ChartBarIcon className="h-6 w-6 text-aqua-400" />
            Gráficos de Monitoramento
            {loadingCharts && (
              <span className="text-xs text-dark-textSecondary font-normal ml-2">(Carregando...)</span>
            )}
          </span>
        }
        className="mb-4"
      />
      <div className="grid grid-cols-1 gap-6">
        {loadingCharts ? (
          <BrandLoading
            message="Carregando histórico hidropônico..."
            size={40}
            className="py-12 bg-dark-surface rounded-lg border border-dark-border"
          />
        ) : (
          <HydroMonitoringChart history={hydroHistory} />
        )}
        {selectedDeviceId ? <ControllerMetricsChart deviceId={selectedDeviceId} /> : null}
      </div>
    </section>
  );
}
