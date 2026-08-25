'use client';

import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { useLevelSensors } from '@/hooks/useLevelSensors';
import { LevelTankSchematic } from '@/components/water-level/LevelTankSchematic';
import { WaterLevelOperationalSummary } from '@/components/water-level/WaterLevelOperationalSummary';
import { useLanguage } from '@/contexts/LanguageContext';

export type WaterLevelSectionProps = {
  deviceId: string;
  enabled?: boolean;
  className?: string;
};

export function WaterLevelSection({
  deviceId,
  enabled = true,
  className = '',
}: WaterLevelSectionProps) {
  const { t } = useLanguage();
  const levels = useLevelSensors(deviceId, enabled);
  const probes = [levels.level1, levels.level2, levels.level3, levels.level4];

  if (!deviceId?.trim() || deviceId === 'default_device') {
    return null;
  }

  return (
    <InstrumentCard
      accent="wait"
      className={className}
      ariaLive="polite"
      title={
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span>{t.automacao.procedures.waterLevel}</span>
          <span className="text-xs font-normal text-dark-textSecondary">
            {t.automacao.procedures.waterLevelSub}
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <LevelTankSchematic className="lg:col-span-5" probes={probes} levelsSimulated={levels.levelsSimulated} />
        <WaterLevelOperationalSummary
          className="lg:col-span-7"
          levels={levels}
          deviceId={deviceId}
        />
      </div>
    </InstrumentCard>
  );
}
