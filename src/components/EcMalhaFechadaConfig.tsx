'use client';

import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { SignalIcon } from '@heroicons/react/24/outline';
import { EcDilutionPreviewCard } from '@/components/EcDilutionPreviewCard';
import { SlaveRelaySelect } from '@/components/SlaveRelaySelect';
import type { ESPNowSlave } from '@/lib/esp-now-slaves';
import { useEcDilutionConfig } from '@/hooks/useEcDilutionConfig';
import { useLastEcDilution } from '@/hooks/useLastEcDilution';
import { hwToast } from '@/lib/control-toast';
import {
  dilutionDrainRef,
  dilutionFillRef,
  validateEcDilutionSlaveAssignment,
  type SlaveRelayRef,
} from '@/lib/slave-relay-allocation';

interface EcMalhaFechadaConfigProps {
  deviceId: string;
  ecActual: number | null;
  ecSetpoint: number;
  tolerance: number;
  tankVolumeL: number;
  espnowSlaves: ESPNowSlave[];
  locked?: boolean;
  autoEnabled?: boolean;
}

export function EcMalhaFechadaConfig({
  deviceId,
  ecActual,
  ecSetpoint,
  tolerance,
  tankVolumeL,
  espnowSlaves,
  locked = false,
  autoEnabled = false,
}: EcMalhaFechadaConfigProps) {
  const config = useEcDilutionConfig(deviceId, Boolean(deviceId?.trim()));
  const lastDilution = useLastEcDilution(deviceId, Boolean(deviceId?.trim()));

  const drainRef = useMemo(
    (): SlaveRelayRef | null =>
      dilutionDrainRef({
        dilution_drain_slave_mac: config.dilution_drain_slave_mac,
        dilution_drain_relay: config.dilution_drain_relay,
      }),
    [config.dilution_drain_slave_mac, config.dilution_drain_relay]
  );

  const fillRef = useMemo(
    (): SlaveRelayRef | null =>
      dilutionFillRef({
        dilution_fill_slave_mac: config.dilution_fill_slave_mac,
        dilution_fill_relay: config.dilution_fill_relay,
      }),
    [config.dilution_fill_slave_mac, config.dilution_fill_relay]
  );

  const onlineSlaves = useMemo(
    () => espnowSlaves.filter((s) => s.status === 'online').length,
    [espnowSlaves]
  );

  const fillReserved = useMemo(
    (): SlaveRelayRef[] => (fillRef ? [fillRef] : []),
    [fillRef]
  );
  const drainReserved = useMemo(
    (): SlaveRelayRef[] => (drainRef ? [drainRef] : []),
    [drainRef]
  );

  const controlsDisabled = locked || config.isLoading || config.isSaving;

  const handleSave = useCallback(async () => {
    const validation = validateEcDilutionSlaveAssignment(
      {
        dilution_drain_slave_mac: config.dilution_drain_slave_mac,
        dilution_drain_relay: config.dilution_drain_relay,
        dilution_fill_slave_mac: config.dilution_fill_slave_mac,
        dilution_fill_relay: config.dilution_fill_relay,
      },
      espnowSlaves
    );
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    const result = await config.save({
      dilution_drain_slave_mac: config.dilution_drain_slave_mac,
      dilution_drain_relay: config.dilution_drain_relay,
      dilution_fill_slave_mac: config.dilution_fill_slave_mac,
      dilution_fill_relay: config.dilution_fill_relay,
      dilution_auto_enabled: autoEnabled,
    });

    if (result.ok) {
      hwToast.success('Diluição automática salva', 'AUTO EC');
    } else {
      toast.error(result.error ?? 'Erro ao salvar');
    }
  }, [autoEnabled, config, espnowSlaves]);

  const setDrainRef = (ref: SlaveRelayRef | null) => {
    config.updateLocal({
      dilution_drain_slave_mac: ref?.slaveMac ?? '',
      dilution_drain_relay: ref?.relayId ?? -1,
    });
  };

  const setFillRef = (ref: SlaveRelayRef | null) => {
    config.updateLocal({
      dilution_fill_slave_mac: ref?.slaveMac ?? '',
      dilution_fill_relay: ref?.relayId ?? -1,
    });
  };

  return (
    <div className="mt-6 pt-6 border-t border-dark-border space-y-5">
      <div>
        <h3 className="text-base font-bold text-dark-text mb-1">
          Diluição automática da solução
        </h3>
        <p className="text-xs sm:text-sm text-dark-textSecondary">
          Quando a EC fica alta demais (acima do valor desejado + tolerância), o sistema drena
          parte da solução, repõe com água limpa até o nível alto e recircula — tudo junto com o
          Auto EC, sem liga/desliga separado. Use os relés Atlas de dreno e reposição abaixo.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-dark-textSecondary rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
        <SignalIcon className="w-4 h-4 text-violet-400 shrink-0" />
        <span>
          {espnowSlaves.length === 0
            ? 'Nenhum HydroWave Atlas ligado — sincronize o Core na bancada.'
            : `${espnowSlaves.length} Atlas · ${onlineSlaves} online`}
        </span>
      </div>

      <EcDilutionPreviewCard
        ecSetpoint={ecSetpoint || config.ec_setpoint}
        tolerance={tolerance || config.tolerance}
        tankVolumeL={tankVolumeL || config.volume}
        ecActual={ecActual}
      />

      <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
          Relés Atlas (dreno + reposição)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SlaveRelaySelect
            slaves={espnowSlaves}
            label="Relé dreno"
            value={drainRef}
            reserved={fillReserved}
            onChange={setDrainRef}
            disabled={controlsDisabled}
            emptyMessage="Nenhum relé Atlas disponível."
          />
          <SlaveRelaySelect
            slaves={espnowSlaves}
            label="Relé reposição (água)"
            value={fillRef}
            reserved={drainReserved}
            onChange={setFillRef}
            disabled={controlsDisabled}
            emptyMessage="Nenhum relé Atlas disponível."
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={controlsDisabled}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50"
      >
        {config.isSaving ? 'Salvando…' : 'Salvar diluição automática'}
      </button>

      {lastDilution.volumeMeasuredL != null && (
        <p className="text-xs text-dark-textSecondary border-t border-dark-border pt-3">
          Última diluição: {lastDilution.volumeMeasuredL.toFixed(1)} L medidos
          {lastDilution.source ? ` · ${lastDilution.source}` : ''}
        </p>
      )}
    </div>
  );
}
