'use client';

import { HW_BADGE } from '@/lib/design-tokens';
import type { LevelSensorsState } from '@/hooks/useLevelSensors';
import { useLanguage } from '@/contexts/LanguageContext';

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap';

export function MixInterlockBadge({
  levels,
  className = '',
}: {
  levels: LevelSensorsState;
  className?: string;
}) {
  const { t } = useLanguage();
  const m = t.automacao.mixInterlock;

  if (levels.circulationTyped === null && levels.circulationMixOk === null) {
    return null;
  }

  if (levels.circulationTyped === false) {
    return (
      <span className={`${badgeBase} ${HW_BADGE.warn} ${className}`} role="status">
        {m.notTyped}
      </span>
    );
  }

  if (levels.circulationMixOk === false) {
    return (
      <span className={`${badgeBase} ${HW_BADGE.danger} ${className}`} role="status">
        {m.inactive}
      </span>
    );
  }

  if (levels.circulationMixOk === true) {
    return (
      <span className={`${badgeBase} ${HW_BADGE.ok} ${className}`} role="status">
        {m.ok}
      </span>
    );
  }

  return null;
}
