'use client';

import dynamic from 'next/dynamic';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import { HydraulicRelaySetupPanel } from '@/components/automacao/HydraulicRelaySetupPanel';
import { EspNowSlaveNamesPanel } from '@/components/automacao/EspNowSlaveNamesPanel';

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
  return (
    <div className="space-y-6 text-[15px] leading-relaxed">
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
