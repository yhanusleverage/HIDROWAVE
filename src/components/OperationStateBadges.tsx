'use client';

import {
  ClockIcon,
  BeakerIcon,
  BoltIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { HW_BADGE, type HwAccent } from '@/lib/design-tokens';

function formatCountdown(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export interface OperationStateBadgesProps {
  autoEnabled: boolean;
  autoActiveLabel: string;
  autoInactiveLabel: string;
  isLoading?: boolean;
  isDosando?: boolean;
  dosandoLabel?: string;
  isReplacing?: boolean;
  replacingLabel?: string;
  isAguardandoRecirculacao?: boolean;
  operationRemainingSec?: number;
  showNextCheck?: boolean;
  nextCheckInSec?: number;
  nextCheckLabel?: string;
  accent?: 'emerald' | 'violet';
  /** header = pills compactas ao lado do título colapsável */
  variant?: 'default' | 'header';
}

const badgeBase =
  'inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap';

export default function OperationStateBadges({
  autoEnabled,
  autoActiveLabel,
  autoInactiveLabel,
  isLoading = false,
  isDosando = false,
  dosandoLabel = 'Dosando',
  isReplacing = false,
  replacingLabel = 'Reponendo',
  isAguardandoRecirculacao = false,
  operationRemainingSec = 0,
  showNextCheck = false,
  nextCheckInSec = 0,
  nextCheckLabel = 'Próxima verificação',
  accent = 'emerald',
  variant = 'default',
}: OperationStateBadgesProps) {
  const sizeClass = variant === 'header' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  const dosandoAccent: HwAccent = accent === 'violet' ? 'ph' : 'ec';

  return (
    <div
      className={`flex flex-wrap items-center ${variant === 'header' ? 'gap-1.5' : 'gap-3'}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`${badgeBase} ${sizeClass} ${
          autoEnabled ? HW_BADGE.ok : HW_BADGE.danger
        }`}
      >
        {autoEnabled ? (
          <BoltIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        ) : (
          <XCircleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        )}
        {isLoading ? '…' : autoEnabled ? autoActiveLabel : autoInactiveLabel}
      </span>

      {isDosando && (
        <span
          className={`${badgeBase} ${sizeClass} animate-pulse ${HW_BADGE[dosandoAccent]}`}
        >
          <BeakerIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {dosandoLabel}
        </span>
      )}

      {isReplacing && (
        <span
          className={`${badgeBase} ${sizeClass} animate-pulse ${HW_BADGE.wait}`}
        >
          <BeakerIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {replacingLabel}
        </span>
      )}

      {isAguardandoRecirculacao && operationRemainingSec > 0 && (
        <span className={`${badgeBase} ${sizeClass} ${HW_BADGE.wait}`}>
          <ClockIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Recirculação {formatCountdown(operationRemainingSec)}
        </span>
      )}

      {showNextCheck && nextCheckInSec > 0 && (
        <span className={`${badgeBase} ${sizeClass} ${HW_BADGE.wait}`}>
          <ClockIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {nextCheckLabel} {formatCountdown(nextCheckInSec)}
        </span>
      )}
    </div>
  );
}
