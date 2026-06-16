'use client';

import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { MetricRow } from '@/components/ui/MetricRow';
import { HW_TEXT } from '@/lib/design-tokens';
import { useLevelSensors } from '@/hooks/useLevelSensors';

const LEVEL_LABELS = ['Nível 1 (topo)', 'Nível 2', 'Nível 3', 'Nível 4 (base)'] as const;

const WATER_LEVEL_PT: Record<string, string> = {
  vazio: 'Vazio',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
};

function levelCell(wet: boolean | null) {
  if (wet === null) return { text: '--', variant: 'default' as const };
  return wet
    ? { text: 'Mojado', variant: 'ok' as const }
    : { text: 'Seco', variant: 'danger' as const };
}

interface WaterLevelStatusCardProps {
  deviceId: string;
  enabled?: boolean;
}

export function WaterLevelStatusCard({ deviceId, enabled = true }: WaterLevelStatusCardProps) {
  const levels = useLevelSensors(deviceId, enabled);
  const wetValues = [levels.level1, levels.level2, levels.level3, levels.level4];
  const hasData = wetValues.some((v) => v !== null) || levels.waterLevel != null;

  if (!deviceId?.trim() || deviceId === 'default_device') {
    return null;
  }

  return (
    <InstrumentCard accent="ph" title="💧 Sensores de Nível (4 sondas)" ariaLive="polite">
      <div className="space-y-2.5">
        <MetricRow
          label="Nível agregado:"
          value={
            levels.waterLevel
              ? WATER_LEVEL_PT[levels.waterLevel] ?? levels.waterLevel
              : levels.isLoading
                ? '…'
                : '--'
          }
          variant={
            levels.waterLevel === 'vazio'
              ? 'danger'
              : levels.waterLevel === 'alto'
                ? 'ok'
                : 'default'
          }
        />
        <MetricRow
          label="OK para Auto EC/pH:"
          value={
            levels.waterLevelOk === null
              ? '--'
              : levels.waterLevelOk
                ? 'Sim'
                : 'Não'
          }
          variant={levels.waterLevelOk ? 'ok' : levels.waterLevelOk === false ? 'alarm' : 'default'}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {LEVEL_LABELS.map((label, i) => {
            const cell = levelCell(wetValues[i]);
            return (
              <div
                key={label}
                className="rounded-lg border border-dark-border/60 bg-dark-surface/40 px-2 py-2 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-dark-textSecondary mb-1">
                  {label}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    cell.variant === 'ok'
                      ? HW_TEXT.ph
                      : cell.variant === 'danger'
                        ? 'text-red-400'
                        : 'text-dark-textSecondary'
                  }`}
                >
                  {cell.text}
                </p>
              </div>
            );
          })}
        </div>
        {!hasData && !levels.isLoading && (
          <p className="text-xs text-dark-textSecondary pt-1">
            Aguardando telemetria — execute ADD_LEVEL_SENSORS_COLUMNS.sql e flasheie o firmware.
          </p>
        )}
      </div>
    </InstrumentCard>
  );
}
