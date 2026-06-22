'use client';

import React from 'react';
import { SignalIcon } from '@heroicons/react/24/outline';
import SensorCard from '@/components/SensorCard';
import BrandLoading from '@/components/BrandLoading';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HydroMeasurement, EnvironmentMeasurement } from '@/lib/supabase';
import { hasHydroSensorReading } from '@/lib/realtime/hydro-ph';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

export interface DashboardSensorsSectionProps {
  loadingSensors: boolean;
  hydroData: HydroMeasurement | null;
  environmentData: EnvironmentMeasurement | null;
  displayTemp: number | null;
  displayPh: number | null;
  calculateEC: (data: HydroMeasurement) => number | null;
  getECStatus: (ec: number) => 'normal' | 'warning' | 'danger';
  getPHStatus: (ph: number) => 'normal' | 'warning' | 'danger';
  onOpenEcConfig: () => void;
  onOpenTempConfig: () => void;
  onOpenPhConfig: () => void;
}

export function DashboardSensorsSection({
  loadingSensors,
  hydroData,
  environmentData,
  displayTemp,
  displayPh,
  calculateEC,
  getECStatus,
  getPHStatus,
  onOpenEcConfig,
  onOpenTempConfig,
  onOpenPhConfig,
}: DashboardSensorsSectionProps) {
  const ecValue = hydroData ? calculateEC(hydroData) : null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader
          accent="brand"
          title={
            <span className="flex items-center gap-2 text-xl font-bold text-dark-text">
              <SignalIcon className="h-6 w-6 text-aqua-400" />
              Sensores
            </span>
          }
          className="mb-0"
        />
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hydroData ? (
            hasHydroSensorReading(hydroData) ? (
              <HwBadge accent="ok">Hydro OK</HwBadge>
            ) : (
              <HwBadge accent="brand">Niveles (sem pH/EC/temp)</HwBadge>
            )
          ) : (
            <HwBadge accent="warn">Sem Hydro</HwBadge>
          )}
          {environmentData ? (
            <HwBadge accent="ok">Env OK</HwBadge>
          ) : (
            <HwBadge accent="warn">Sem Env</HwBadge>
          )}
        </div>
      </div>

      {loadingSensors ? (
        <BrandLoading message="Carregando sensores..." className="py-12" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <SensorCard
              title="Temperatura da Água"
              value={displayTemp !== null ? formatSensorValue(displayTemp, 1) : '--'}
              unit="°C"
              status={
                displayTemp !== null
                  ? displayTemp < 18 || displayTemp > 26
                    ? 'warning'
                    : 'normal'
                  : 'normal'
              }
            />
            <button
              type="button"
              onClick={onOpenTempConfig}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-aqua-500/20 border border-dark-border hover:border-aqua-500/50 transition-colors"
              aria-label="Configurar umbrales de temperatura"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 text-aqua-400" />
            </button>
          </div>

          <div className="relative">
            <SensorCard
              title="pH"
              domain="ph"
              value={displayPh !== null ? formatSensorValue(displayPh, 2) : '--'}
              status={displayPh !== null ? getPHStatus(displayPh) : 'normal'}
            />
            <button
              type="button"
              onClick={onOpenPhConfig}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-violet-500/20 border border-dark-border hover:border-violet-500/50 transition-colors"
              aria-label="Configurar umbrales de pH"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 text-violet-400" />
            </button>
          </div>

          <div className="relative">
            <SensorCard
              title="EC"
              domain="ec"
              value={ecValue !== null ? formatSensorValue(ecValue, 0) : '--'}
              unit="µS/cm"
              status={ecValue !== null ? getECStatus(ecValue) : 'normal'}
            />
            <button
              type="button"
              onClick={onOpenEcConfig}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-surface hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
              aria-label="Configurar umbrales de EC"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-400" />
            </button>
          </div>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-dark-surface border border-dark-border rounded-lg">
          <details className="text-xs">
            <summary className="cursor-pointer text-dark-textSecondary hover:text-dark-text">
              Debug: Dados Recebidos
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <strong className="text-aqua-400">Hydro Data:</strong>
                <pre className="mt-1 p-2 bg-dark-bg rounded text-dark-textSecondary overflow-auto">
                  {JSON.stringify(hydroData, null, 2)}
                </pre>
              </div>
              <div>
                <strong className="text-aqua-400">Environment Data:</strong>
                <pre className="mt-1 p-2 bg-dark-bg rounded text-dark-textSecondary overflow-auto">
                  {JSON.stringify(environmentData, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
