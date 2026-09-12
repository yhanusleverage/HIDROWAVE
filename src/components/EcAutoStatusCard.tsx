'use client';

import { useMemo } from 'react';
import NavLink from '@/components/NavLink';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_TEXT } from '@/lib/design-tokens';
import OperationStateBadges from '@/components/OperationStateBadges';
import { AutoControlStatusMetrics } from '@/components/AutoControlStatusMetrics';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useEcDilutionState } from '@/hooks/useEcDilutionState';
import { useEcConfig } from '@/hooks/useEcConfig';
import { useHydroEcReading } from '@/hooks/useHydroEcReading';
import { useLevelSensors } from '@/hooks/useLevelSensors';
import { MixInterlockBadge } from '@/components/MixInterlockBadge';
import { ecErrorAbs } from '@/lib/ec-control-display';
import { estimateEcDoseSplit } from '@/lib/ec-dose-preview';
import {
  estimateEcCycleBreakdown,
  formatCyclePreview,
} from '@/lib/dose-cycle-eta';
import { formatSensorValue } from '@/lib/format-sensor-value';
import { useLanguage } from '@/contexts/LanguageContext';

interface EcAutoStatusCardProps {
  deviceId: string;
}

export function EcAutoStatusCard({ deviceId }: EcAutoStatusCardProps) {
  const { t } = useLanguage();
  const ec = t.automacao.ec;
  const dil = t.automacao.dilution;
  const auto = t.dashboard.auto;

  const active = Boolean(deviceId?.trim());
  const ecConfig = useEcConfig(deviceId, active);
  const configReady = active && !ecConfig.isLoading;
  const { ec: ecAtual } = useHydroEcReading(deviceId, active, { liveOnly: true });
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
    operationCycleRemainingSec,
    nextCheckInSec,
    isEcCheckPending,
    operationInterrupted,
    isDiluting,
  } = useEcOperationState(deviceId, configReady, {
    intervalCeilingSec: ecConfig.intervalo_auto_ec,
    autoEnabled: ecConfig.auto_enabled,
    mirrorFirmware: ecConfig.auto_enabled,
  });

  const dilutionState = useEcDilutionState(deviceId, active, {
    mirrorFirmware: true,
  });
  const levels = useLevelSensors(deviceId, active);

  const idleCyclePreview = useMemo(() => {
    if (
      !ecConfig.auto_enabled ||
      isDosando ||
      isAguardandoRecirculacao ||
      isDiluting ||
      ecAtual == null
    ) {
      return null;
    }
    const split = estimateEcDoseSplit({
      volumeL: ecConfig.volume,
      baseDose: ecConfig.base_dose,
      ecSetpoint: ecConfig.ec_setpoint,
      ecActual: ecAtual,
      tolerance: ecConfig.tolerance,
      aggressiveness: ecConfig.aggressiveness,
      nutrients: ecConfig.nutrients,
    });
    if (!split) return null;
    const breakdown = estimateEcCycleBreakdown({
      nutrients: split.parts.map((p) => ({
        ml: p.ml,
        flowRateMlPerSec: p.flowRateMlPerSec,
      })),
      pulseMl: ecConfig.pulse_ml,
      pulseGapSec: ecConfig.pulse_gap_sec,
      recircSec: ecConfig.tempo_recirculacao,
    });
    return breakdown ? formatCyclePreview(breakdown.totalSec) : null;
  }, [ecConfig, ecAtual, isDosando, isAguardandoRecirculacao, isDiluting]);

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
      ? auto.limitLower.replace(
          '{n}',
          String(ecConfig.ec_setpoint - ecConfig.tolerance)
        )
      : undefined;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold flex items-center gap-2 ${HW_TEXT.ec}`}>
          <BeakerIcon className="w-6 h-6" />
          {ec.title}
        </h2>
        <NavLink
          href="/automacao"
          className={`text-sm transition-colors ${HW_TEXT.brand} hover:opacity-80`}
        >
          {auto.openAutomacao}
        </NavLink>
      </div>

      <InstrumentCard accent="ec">
        <OperationStateBadges
          autoEnabled={ecConfig.auto_enabled}
          autoActiveLabel={ec.autoActive}
          autoInactiveLabel={ec.autoInactive}
          isLoading={ecConfig.isLoading}
          isDosando={isDosando}
          dosandoLabel={ec.dosing}
          isAguardandoRecirculacao={isAguardandoRecirculacao}
          operationRemainingSec={operationRemainingSec}
          cycleRemainingSec={operationCycleRemainingSec}
          cycleLabel={ec.cycleBadge}
          showNextCheck={showNextCheck}
          nextCheckInSec={nextCheckInSec}
          nextCheckLabel={ec.nextCheck}
          accent="emerald"
          operationInterrupted={operationInterrupted}
        />
        <div className="mt-2">
          <MixInterlockBadge levels={levels} />
        </div>

        {dilutionState.isDraining && dilutionState.targetL > 0 && (
          <div className="mt-4 mb-2 space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5">
            <div className="flex justify-between text-xs text-cyan-300">
              <span>{dil.stateDraining}</span>
              <span className="font-medium tabular-nums">
                {dilutionState.progressL.toFixed(1)} / {dilutionState.targetL.toFixed(1)} L
              </span>
            </div>
            <div className="h-2 rounded-full bg-dark-surface overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${Math.round(dilutionState.progressRatio * 100)}%` }}
              />
            </div>
          </div>
        )}

        {dilutionState.isFilling && (
          <div className="mt-4 mb-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5">
            <p className="text-xs text-cyan-300">{dil.stateFilling}</p>
          </div>
        )}

        <AutoControlStatusMetrics
          accent="ec"
          metrics={[
            {
              label: ec.ecActual.replace(/:$/, ''),
              value: ecAtual != null ? `${formatSensorValue(ecAtual, 0)} µS/cm` : '--',
            },
            {
              label: auto.ecErrorAbs,
              value: ecError != null ? `${formatSensorValue(ecError, 0)} µS/cm` : '--',
            },
            {
              label: auto.lastDose,
              value: totalMl != null ? `${totalMl.toFixed(2)} ml` : '-- ml',
              loading: dosageLoading && totalMl == null,
            },
            {
              label: auto.setpoint,
              value: ecConfig.ec_setpoint > 0 ? `${ecConfig.ec_setpoint} µS/cm` : '--',
            },
          ]}
          footer={{
            bandLabel: `${ecConfig.tolerance} µS/cm · ${ecConfig.intervalo_auto_ec}s`,
            recircSec: ecConfig.tempo_recirculacao,
            limitHint,
            nextCyclePreview: idleCyclePreview,
          }}
          dosageHint={
            !available ? <span>{auto.missingNutrientTable}</span> : undefined
          }
        />
      </InstrumentCard>
    </section>
  );
}
