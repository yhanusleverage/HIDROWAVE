'use client';

import NavLink from '@/components/NavLink';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_TEXT } from '@/lib/design-tokens';
import OperationStateBadges from '@/components/OperationStateBadges';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useEcConfig } from '@/hooks/useEcConfig';

interface EcAutoStatusCardProps {
  deviceId: string;
}

export function EcAutoStatusCard({ deviceId }: EcAutoStatusCardProps) {
  const active = Boolean(deviceId?.trim());
  const ecConfig = useEcConfig(deviceId, active);
  const configReady = active && !ecConfig.isLoading;
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
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-4">
          <div>
            <p className="text-dark-textSecondary mb-0.5">Última dosagem</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {dosageLoading && totalMl == null
                ? '…'
                : totalMl != null
                  ? `${totalMl.toFixed(2)} ml`
                  : '-- ml'}
            </p>
            {!available && (
              <p className="text-xs text-amber-400/80 mt-1">
                Tabela nutrient_dosages ausente
              </p>
            )}
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Setpoint</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {ecConfig.ec_setpoint > 0
                ? `${ecConfig.ec_setpoint} µS/cm`
                : '--'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Banda morta / intervalo</p>
            <p className={`text-lg font-semibold tabular-nums ${HW_TEXT.ec}`}>
              {ecConfig.tolerance} µS/cm · {ecConfig.intervalo_auto_ec}s
            </p>
            {ecConfig.ec_setpoint > 0 && (
              <p className="text-xs text-dark-textSecondary mt-0.5">
                Limite: {ecConfig.ec_setpoint - ecConfig.tolerance} µS/cm
              </p>
            )}
          </div>
        </div>
      </InstrumentCard>
    </section>
  );
}
