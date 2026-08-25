'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { HydraulicRolesMap } from '@/lib/hydraulic-relay-roles';
import { HydraulicRelaySetupPanel } from '@/components/automacao/HydraulicRelaySetupPanel';
import { EspNowSlaveNamesPanel } from '@/components/automacao/EspNowSlaveNamesPanel';
import { ProcedureBuilderPanel } from '@/components/automacao/ProcedureBuilderPanel';
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

export function ProceduresTabPanel({
  deviceId,
  espnowSlaves,
  waterLevelEnabled,
  onSlavesRefresh,
}: ProceduresTabPanelProps) {
  const { t } = useLanguage();
  const [hydraulicRoles, setHydraulicRoles] = useState<HydraulicRolesMap>({});

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border px-3 py-2 text-center text-xs font-medium ${HW_BANNER.warn}`}>
        {t.automacao.procedures.banner}
      </div>

      <EspNowSlaveNamesPanel
        deviceId={deviceId}
        slaves={espnowSlaves}
        onSlavesRefresh={onSlavesRefresh}
      />

      <HydraulicRelaySetupPanel
        deviceId={deviceId}
        espnowSlaves={espnowSlaves}
        onRolesChange={setHydraulicRoles}
      />

      {deviceId && deviceId !== 'default_device' && (
        <WaterLevelSection deviceId={deviceId} enabled={waterLevelEnabled} />
      )}

      <ProcedureBuilderPanel
        deviceId={deviceId}
        hydraulicRoles={hydraulicRoles}
        embedded
      />
    </div>
  );
}
