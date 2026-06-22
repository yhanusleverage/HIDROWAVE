'use client';

import { ClockIcon } from '@heroicons/react/24/outline';
import { HW_BANNER, HW_TEXT } from '@/lib/design-tokens';

function defaultFormatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${seconds}s`;
}

export interface OperationStateBannersProps {
  autoEnabled?: boolean;
  isDosando?: boolean;
  dosandoLabel?: string;
  isAguardandoRecirculacao?: boolean;
  operationRemainingSec?: number;
  showNextCheck?: boolean;
  nextCheckInSec?: number;
  nextCheckLabel?: string;
  formatCountdown?: (totalSec: number) => string;
}

/**
 * Banners de estado MQTT (paridade EC Status do Controle).
 * Dosando = ping verde; recirc = cyan; próxima verificação = violet.
 */
export default function OperationStateBanners({
  autoEnabled = false,
  isDosando = false,
  dosandoLabel = 'Dosando',
  isAguardandoRecirculacao = false,
  operationRemainingSec = 0,
  showNextCheck = false,
  nextCheckInSec = 0,
  nextCheckLabel = 'Próxima verificação',
  formatCountdown = defaultFormatCountdown,
}: OperationStateBannersProps) {
  if (!autoEnabled) return null;

  return (
    <>
      {isDosando && (
        <div
          className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg border ${HW_BANNER.ec}`}
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className={`text-base font-semibold tracking-wide animate-pulse ${HW_TEXT.ec}`}>
            {dosandoLabel}
          </span>
        </div>
      )}

      {!isDosando && isAguardandoRecirculacao && operationRemainingSec > 0 && (
        <div
          className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg border ${HW_BANNER.wait}`}
          role="status"
          aria-live="polite"
        >
          <ClockIcon className={`w-4 h-4 shrink-0 animate-pulse ${HW_TEXT.wait}`} />
          <span className={`text-base font-semibold tracking-wide ${HW_TEXT.wait}`}>
            Aguardando recirculação
          </span>
          <span className="text-sm font-mono tabular-nums text-cyan-300/90 bg-cyan-500/10 px-2 py-0.5 rounded">
            {formatCountdown(operationRemainingSec)}
          </span>
        </div>
      )}

      {!isDosando &&
        !isAguardandoRecirculacao &&
        showNextCheck &&
        nextCheckInSec > 0 && (
          <div
            className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg border ${HW_BANNER.ph}`}
            role="status"
            aria-live="polite"
          >
            <ClockIcon className={`w-4 h-4 shrink-0 ${HW_TEXT.ph}`} />
            <span className={`text-base font-semibold tracking-wide ${HW_TEXT.ph}`}>
              {nextCheckLabel}
            </span>
            <span className="text-sm font-mono tabular-nums text-violet-300/90 bg-violet-500/10 px-2 py-0.5 rounded">
              {formatCountdown(nextCheckInSec)}
            </span>
          </div>
        )}
    </>
  );
}
