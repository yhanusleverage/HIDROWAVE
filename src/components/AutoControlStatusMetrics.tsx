'use client';

import type { ReactNode } from 'react';
import { HW_TEXT } from '@/lib/design-tokens';

export type AutoControlMetric = {
  label: string;
  value: ReactNode;
  loading?: boolean;
};

export type AutoControlMetricsFooter = {
  bandLabel: string;
  recircSec?: number;
  limitHint?: string;
};

type AutoControlStatusMetricsProps = {
  accent: 'ec' | 'ph';
  metrics: [AutoControlMetric, AutoControlMetric, AutoControlMetric, AutoControlMetric];
  footer: AutoControlMetricsFooter;
  /** Aviso opcional bajo una métrica (ej. tabela ausente). */
  dosageHint?: ReactNode;
};

export function AutoControlStatusMetrics({
  accent,
  metrics,
  footer,
  dosageHint,
}: AutoControlStatusMetricsProps) {
  const valueClass = accent === 'ec' ? HW_TEXT.ec : HW_TEXT.ph;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
        {metrics.map((metric, index) => (
          <div key={metric.label}>
            <p className="text-dark-textSecondary mb-0.5">{metric.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${valueClass}`}>
              {metric.loading ? '…' : metric.value}
            </p>
            {index === 2 && dosageHint ? (
              <div className="text-xs text-amber-400/80 mt-1">{dosageHint}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t border-dark-border/40 pt-3 mt-4 text-sm">
        <p className="text-dark-textSecondary mb-0.5">Banda morta / intervalo</p>
        <p className={`font-semibold tabular-nums ${valueClass}`}>{footer.bandLabel}</p>
        {(footer.recircSec != null && footer.recircSec > 0) || footer.limitHint ? (
          <p className="text-xs text-dark-textSecondary mt-1 space-x-3">
            {footer.recircSec != null && footer.recircSec > 0 ? (
              <span>Recirculação: {footer.recircSec}s</span>
            ) : null}
            {footer.limitHint ? <span>{footer.limitHint}</span> : null}
          </p>
        ) : null}
      </div>
    </>
  );
}
