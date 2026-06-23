'use client';

import NavLink from '@/components/NavLink';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_TEXT } from '@/lib/design-tokens';
import OperationStateBadges from '@/components/OperationStateBadges';
import { AutoControlStatusMetrics } from '@/components/AutoControlStatusMetrics';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useEcConfig } from '@/hooks/useEcConfig';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { ecErrorAbs } from '@/lib/ec-control-display';
import { formatSensorValue } from '@/lib/format-sensor-value';

interface EcAutoStatusCardProps {
  deviceId: string;
}

export function EcAutoStatusCard({ deviceId }: EcAutoStatusCardProps) {
  const active = Boolean(deviceId?.trim());
  const ecConfig = useEcConfig(deviceId, active);
  const configReady = active && !ecConfig.isLoading;
  const { ec: ecAtual } = useHydroEcReading(deviceId, active);
  const ecError =
    ecAtual != null && ecConfig.ec_setpoint > 0
      ? ecErrorAbs(ecConfig.ec_setpoint, ecAtual)
      : null;

  const { totalMl, isLoading: dosageLoading, available } = useLastDosage(
    deviceId,
    active
  );
  const {
    isDosando,
    isAguardandoRecirculacao,
    operationRemainingSec,
    nextCheckInSec,
    isEcCheckPending,
    operationInterrupted,
  } = useEcOperationState(deviceId, configReady, {
    intervalCeilingSec: ecConfig.intervalo_auto_ec,
    autoEnabled: ecConfig.auto_enabled,
    mirrorFirmware: ecConfig.auto_enabled,
  });

  if (!active) {
    return null;
  }

  const showNextCheck =
    ecConfig.auto_enabled &&
    !isDosando &&
    !isAguardandoRecirculacao &&
    (isEcCheckPending || nextCheckInSec > 0);

  const limitHint =
    ecConfig.ec_setpoint > 0
      ? `Limite inferior: ${ecConfig.ec_setpoint - ecConfig.tolerance} µS/cm`
      : undefined;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold flex items-center gap-2 ${HW_TEXT.ec}`}>
          <BeakerIcon className="w-6 h-6" />
          Auto EC
        </h2>
        <NavLink
          href="/automacao"
          className={`text-sm transition-colors ${HW_TEXT.brand} hover:opacity-80`}
        >
          Abrir automação →
        </NavLink>
      </div>

      <InstrumentCard accent="ec">
        <OperationStateBadges
          autoEnabled={ecConfig.auto_enabled}
          autoActiveLabel="Auto EC ativo"
          autoInactiveLabel="Auto EC inativo"
          isLoading={ecConfig.isLoading}
          isDosando={isDosando}
          isAguardandoRecirculacao={isAguardandoRecirculacao}
          operationRemainingSec={operationRemainingSec}
          showNextCheck={showNextCheck}
          nextCheckInSec={nextCheckInSec}
          nextCheckLabel="Próxima verificação EC"
          accent="emerald"
          operationInterrupted={operationInterrupted}
        />

        <AutoControlStatusMetrics
          accent="ec"
          metrics={[
            {
              label: 'EC Atual',
              value: ecAtual != null ? `${formatSensorValue(ecAtual, 0)} µS/cm` : '--',
            },
            {
              label: 'Erro (|EC − SP|)',
              value: ecError != null ? `${formatSensorValue(ecError, 0)} µS/cm` : '--',
            },
            {
              label: 'Última dosagem',
              value:
                totalMl != null ? `${totalMl.toFixed(2)} ml` : '-- ml',
              loading: dosageLoading && totalMl == null,
            },
            {
              label: 'Setpoint',
              value: ecConfig.ec_setpoint > 0 ? `${ecConfig.ec_setpoint} µS/cm` : '--',
            },
          ]}
          footer={{
            bandLabel: `${ecConfig.tolerance} µS/cm · ${ecConfig.intervalo_auto_ec}s`,
            recircSec: ecConfig.tempo_recirculacao,
            limitHint,
          }}
          dosageHint={
            !available ? <span>Tabela nutrient_dosages ausente</span> : undefined
          }
        />
      </InstrumentCard>
    </section>
  );
}
