'use client';

import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import { HydraulicRelaySetupPanel } from '@/components/automacao/HydraulicRelaySetupPanel';
import { EspNowSlaveNamesPanel } from '@/components/automacao/EspNowSlaveNamesPanel';
import { HW_BANNER } from '@/lib/design-tokens';

const WaterLevelSection = dynamic(
  () => import('@/components/WaterLevelSection').then((m) => m.WaterLevelSection),
  { ssr: false }
);

interface ProceduresTabPanelProps {
  deviceId: string;
  espnowSlaves: ESPNowSlave[];
  waterLevelEnabled: boolean;
  onSlavesRefresh?: () => void | Promise<void>;
}

/** Tipagem P1: só bomba de recirculação. Dreno/enchimento = relé Atlas no procedimento. */
export function ProceduresTabPanel({
  deviceId,
  espnowSlaves,
  waterLevelEnabled,
  onSlavesRefresh,
}: ProceduresTabPanelProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;

  return (
    <div className="space-y-6 text-[15px] leading-relaxed">
      <div className={`rounded-lg border px-4 py-3 text-center text-sm font-medium ${HW_BANNER.warn}`}>
        {p.banner}
      </div>

      <EspNowSlaveNamesPanel
        deviceId={deviceId}
        slaves={espnowSlaves}
        onSlavesRefresh={onSlavesRefresh}
      />

      {waterLevelEnabled && (
        <WaterLevelSection deviceId={deviceId} enabled={waterLevelEnabled} />
      )}

      <HydraulicRelaySetupPanel
        deviceId={deviceId}
        espnowSlaves={espnowSlaves}
        mode="essential"
      />
    </div>
  );
}
