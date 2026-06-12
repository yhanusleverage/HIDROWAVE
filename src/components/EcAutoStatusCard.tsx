'use client';

import Link from 'next/link';
import { ClockIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { useLastDosage } from '@/hooks/useLastDosage';
import { useEcOperationState } from '@/hooks/useEcOperationState';
import { useEcConfig } from '@/hooks/useEcConfig';

interface EcAutoStatusCardProps {
  deviceId: string;
}

function formatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export function EcAutoStatusCard({ deviceId }: EcAutoStatusCardProps) {
  const active = Boolean(deviceId?.trim());
  const ecConfig = useEcConfig(deviceId, active);
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
  } = useEcOperationState(deviceId, active, {
    intervalCeilingSec: ecConfig.intervalo_auto_ec,
    autoEnabled: ecConfig.auto_enabled,
    mirrorFirmware: true,
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
        <h2 className="text-xl font-bold text-dark-text flex items-center gap-2">
          <BeakerIcon className="w-6 h-6 text-violet-400" />
          Auto EC
        </h2>
        <Link
          href="/automacao"
          className="text-sm text-aqua-400 hover:text-aqua-300 transition-colors"
        >
          Abrir automação →
        </Link>
      </div>

      <div className="bg-dark-surface border border-dark-border rounded-lg p-5 shadow-lg">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span
            className={`text-sm font-medium px-2.5 py-1 rounded-full border ${
              ecConfig.auto_enabled
                ? 'bg-green-500/15 text-green-400 border-green-500/40'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}
          >
            {ecConfig.isLoading
              ? '…'
              : ecConfig.auto_enabled
                ? 'Auto EC ativo'
                : 'Auto EC inativo'}
          </span>

          {isDosando && (
            <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 animate-pulse">
              Dosando
            </span>
          )}

          {isAguardandoRecirculacao && operationRemainingSec > 0 && (
            <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              Recirculação {formatCountdown(operationRemainingSec)}
            </span>
          )}

          {showNextCheck && (
            <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/40 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              Próxima verificação {formatCountdown(nextCheckInSec)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-dark-textSecondary mb-0.5">Última dosagem</p>
            <p className="text-lg font-semibold text-dark-text tabular-nums">
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
            <p className="text-lg font-semibold text-dark-text tabular-nums">
              {ecConfig.ec_setpoint > 0
                ? `${ecConfig.ec_setpoint} µS/cm`
                : '--'}
            </p>
          </div>
          <div>
            <p className="text-dark-textSecondary mb-0.5">Intervalo / tolerância</p>
            <p className="text-lg font-semibold text-dark-text tabular-nums">
              {ecConfig.intervalo_auto_ec}s · ±{ecConfig.tolerance} µS/cm
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
