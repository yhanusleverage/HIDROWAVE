'use client';

import NavLink from '@/components/NavLink';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_TEXT } from '@/lib/design-tokens';
import OperationStateBadges from '@/components/OperationStateBadges';
import { usePhConfig } from '@/hooks/usePhConfig';
import { usePhOperationState } from '@/hooks/usePhOperationState';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { phErrorAbs } from '@/lib/ph-control-display';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { supabase } from '@/lib/supabase';
import { subscribeRelayStateUpdates } from '@/lib/realtime/relay-states';
import { subscribePhDosageInserts } from '@/lib/realtime/ph-dosages';
import { useCallback, useEffect, useState } from 'react';

interface PhAutoStatusCardProps {
  deviceId: string;
}

export function PhAutoStatusCard({ deviceId }: PhAutoStatusCardProps) {
  const active = Boolean(deviceId?.trim());
  const phConfig = usePhConfig(deviceId, active);
  const configReady = active && !phConfig.isLoading;
  const [doserRelayStates, setDoserRelayStates] = useState<boolean[]>([]);

  const {
    isDosando,
    isAguardandoRecirculacao,
    operationRemainingSec,
    nextCheckInSec,
  } = usePhOperationState(deviceId, configReady, {
    intervalCeilingSec: phConfig.intervalo_auto_ph,
    autoEnabled: phConfig.auto_enabled,
    mirrorFirmware: phConfig.auto_enabled,
    relayFallback: {
      relayPhUp: phConfig.relay_ph_up,
      relayPhDown: phConfig.relay_ph_down,
      doserRelayStates,
    },
  });

  const { ph: phAtual } = useHydroEcReading(deviceId, active);
  const phError =
    phAtual != null && phConfig.ph_setpoint > 0
      ? phErrorAbs(phConfig.ph_setpoint, phAtual)
      : null;

  const [lastDosageMl, setLastDosageMl] = useState<number | null>(null);
  const [dosageLoading, setDosageLoading] = useState(true);

  const fetchLastDosage = useCallback(async () => {
    if (!active) return;
    setDosageLoading(true);
    try {
      const { data, error } = await supabase
        .from('ph_dosages')
        .select('dosage_ml')
        .eq('device_id', deviceId.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLastDosageMl(Number(data.dosage_ml) || 0);
      } else {
        setLastDosageMl(null);
      }
    } catch {
      setLastDosageMl(null);
    } finally {
      setDosageLoading(false);
    }
  }, [active, deviceId]);

  useEffect(() => {
    fetchLastDosage();
  }, [fetchLastDosage]);

  useEffect(() => {
    if (!active || !deviceId?.trim()) return;
    return subscribePhDosageInserts(deviceId.trim(), (row) => {
      setLastDosageMl(Number(row.dosage_ml) || 0);
      setDosageLoading(false);
    });
  }, [active, deviceId]);

  useEffect(() => {
    if (!deviceId?.trim()) return;

    const applyDoserStates = (row: { doser_relay_states?: boolean[] }) => {
      if (row.doser_relay_states?.length) {
        setDoserRelayStates(row.doser_relay_states);
      }
    };

    void supabase
      .from('relay_master')
      .select('doser_relay_states')
      .eq('device_id', deviceId.trim())
      .maybeSingle()
      .then(({ data }) => {
        if (data) applyDoserStates(data);
      });

    return subscribeRelayStateUpdates(deviceId.trim(), applyDoserStates, () => {});
  }, [deviceId]);

  if (!active) {
    return null;
  }

  const showNextCheck =
    phConfig.auto_enabled &&
    !isDosando &&
    !isAguardandoRecirculacao &&
    nextCheckInSec > 0;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold flex items-center gap-2 ${HW_TEXT.ph}`}>
          <BeakerIcon className="w-6 h-6" />
          Auto pH
        </h2>
        <NavLink
          href="/automacao"
          className={`text-sm transition-colors ${HW_TEXT.brand} hover:opacity-80`}
        >
          Abrir automação →
        </NavLink>
      </div>

      <InstrumentCard accent="ph">
        <OperationStateBadges
          autoEnabled={phConfig.auto_enabled}
          autoActiveLabel="Auto pH ativo"
          autoInactiveLabel="Auto pH inativo"
          isLoading={phConfig.isLoading}
          isDosando={isDosando}
          dosandoLabel={
            isDosando && operationRemainingSec > 0
              ? `Dosando pH (${operationRemainingSec}s)`
              : 'Dosando pH'
          }
          isAguardandoRecirculacao={isAguardandoRecirculacao}
          operationRemainingSec={operationRemainingSec}
          showNextCheck={showNextCheck}
          nextCheckInSec={nextCheckInSec}
          nextCheckLabel="Próxima verificação pH"
          accent="violet"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
          <div>
            <p className="text-dark-textSecondary mb-0.5">pH Atual</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {phAtual != null ? formatSensorValue(phAtual, 2) : '--'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Erro (|pH − SP|)</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {phError != null ? formatSensorValue(phError, 2) : '--'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Última dosagem</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {dosageLoading && lastDosageMl == null
                ? '…'
                : lastDosageMl != null
                  ? `${lastDosageMl.toFixed(2)} ml`
                  : '-- ml'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Setpoint</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ph}`}>
              {phConfig.ph_setpoint > 0 ? `pH ${phConfig.ph_setpoint.toFixed(1)}` : '--'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Banda morta / intervalo</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ph}`}>
              ± {phConfig.ph_tolerance.toFixed(2)} · {phConfig.intervalo_auto_ph}s
            </p>
            {phConfig.ph_setpoint > 0 && (
              <p className="text-xs text-dark-textSecondary mt-0.5">
                Recirculação: {phConfig.tempo_recirculacao}s
              </p>
            )}
          </div>
        </div>
      </InstrumentCard>
    </section>
  );
}
