'use client';

import React from 'react';
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import type { DocsCalloutContent } from '@/lib/translations/docs/types';

const VARIANT_STYLES = {
  info: {
    border: 'border-aqua-500/40',
    bg: 'bg-aqua-500/10',
    icon: InformationCircleIcon,
    iconClass: 'text-aqua-400',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    icon: ExclamationTriangleIcon,
    iconClass: 'text-amber-400',
  },
  tip: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    icon: LightBulbIcon,
    iconClass: 'text-emerald-400',
  },
} as const;

export function DocsCallout({ variant, title, body }: DocsCalloutContent) {
  const style = VARIANT_STYLES[variant];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg border p-4 my-4 ${style.border} ${style.bg}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconClass}`} />
        <div>
          <p className="font-semibold text-dark-text text-sm">{title}</p>
          <p className="text-sm text-dark-textSecondary mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
