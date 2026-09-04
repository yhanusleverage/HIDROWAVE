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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
        mode="essential"
        roles={hydraulicRoles}
        onRolesStateChange={setHydraulicRoles}
      />

      <div className="rounded-xl border border-dark-border bg-dark-card/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-surface/50 transition-colors"
          aria-expanded={advancedOpen}
        >
          <div>
            <p className="text-sm font-medium text-dark-text">
              {t.automacao.procedures.advancedToggle}
            </p>
            <p className="text-xs text-dark-textSecondary mt-0.5">
              {t.automacao.procedures.advancedHint}
            </p>
          </div>
          <span className="text-aqua-400 text-lg leading-none shrink-0">
            {advancedOpen ? '−' : '+'}
          </span>
        </button>

        {advancedOpen && (
          <div className="border-t border-dark-border p-4 space-y-6">
            <HydraulicRelaySetupPanel
              deviceId={deviceId}
              espnowSlaves={espnowSlaves}
              mode="advanced"
              roles={hydraulicRoles}
              onRolesStateChange={setHydraulicRoles}
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
        )}
      </div>
    </div>
  );
}
