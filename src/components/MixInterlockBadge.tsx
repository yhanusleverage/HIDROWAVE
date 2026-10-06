'use client';

import {
  ArrowPathIcon,
  PauseCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { HW_BADGE } from '@/lib/design-tokens';
import type { LevelSensorsState } from '@/hooks/useLevelSensors';
import { useLanguage } from '@/contexts/LanguageContext';

const badgeBase =
  'inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap';

export function MixInterlockBadge({
  levels,
  variant = 'default',
  className = '',
}: {
  levels: LevelSensorsState;
  /** default = status cards; header = pills junto ao título colapsável */
  variant?: 'default' | 'header';
  className?: string;
}) {
  const { t } = useLanguage();
  const m = t.automacao.mixInterlock;
  const sizeClass = variant === 'header' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  if (levels.circulationTyped === null && levels.circulationMixOk === null) {
    return null;
  }

  if (levels.circulationTyped === false) {
    return (
      <span
        className={`${badgeBase} ${sizeClass} ${HW_BADGE.warn} ${className}`}
        role="status"
      >
        <XCircleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {m.notTyped}
      </span>
    );
  }

  if (levels.circulationMixOk === false) {
    return (
      <span
        className={`${badgeBase} ${sizeClass} ${HW_BADGE.danger} ${className}`}
        role="status"
      >
        <PauseCircleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {m.inactive}
      </span>
    );
  }

  if (levels.circulationMixOk === true) {
    return (
      <span
        className={`${badgeBase} ${sizeClass} ${HW_BADGE.ok} ${className}`}
        role="status"
      >
        <ArrowPathIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {m.ok}
      </span>
    );
  }

  return null;
}
