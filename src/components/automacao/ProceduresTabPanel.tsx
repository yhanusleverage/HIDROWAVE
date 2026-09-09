'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import type { HydraulicRolesMap } from '@/lib/hydraulic-relay-roles';
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

export function ProceduresTabPanel({
  deviceId,
  espnowSlaves,
  waterLevelEnabled,
  onSlavesRefresh,
}: ProceduresTabPanelProps) {
  const { t } = useLanguage();
  const p = t.automacao.procedures;
  const [hydraulicRoles, setHydraulicRoles] = useState<HydraulicRolesMap>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        roles={hydraulicRoles}
        onRolesStateChange={setHydraulicRoles}
      />

      <div className="rounded-xl border border-dark-border bg-dark-card/60 overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-surface/50"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <div>
            <p className="text-sm font-semibold text-dark-text">{p.advancedToggle}</p>
            <p className="mt-0.5 text-xs text-dark-textSecondary">{p.advancedHint}</p>
          </div>
          <span className="text-dark-textSecondary shrink-0">{showAdvanced ? '▾' : '▸'}</span>
        </button>

        {showAdvanced && (
          <div className="border-t border-dark-border px-4 py-4 space-y-4">
            <HydraulicRelaySetupPanel
              deviceId={deviceId}
              espnowSlaves={espnowSlaves}
              mode="advanced"
              roles={hydraulicRoles}
              onRolesStateChange={setHydraulicRoles}
            />
          </div>
        )}
      </div>
    </div>
  );
}
