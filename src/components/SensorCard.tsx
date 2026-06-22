import React from 'react';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_BADGE, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

type SensorCardProps = {
  title: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  status?: 'normal' | 'warning' | 'danger';
  domain?: 'ph' | 'ec' | 'brand';
};

const statusAccent: Record<NonNullable<SensorCardProps['status']>, HwAccent> = {
  normal: 'brand',
  warning: 'warn',
  danger: 'danger',
};

const statusText = {
  normal: 'Normal',
  warning: 'Aviso',
  danger: 'Perigo',
};

function resolveAccent(
  status: SensorCardProps['status'],
  domain: SensorCardProps['domain']
): HwAccent {
  if (status === 'warning') return 'warn';
  if (status === 'danger') return 'danger';
  if (domain === 'ph') return 'ph';
  if (domain === 'ec') return 'ec';
  return 'brand';
}

function valueColor(status: SensorCardProps['status'], domain: SensorCardProps['domain']): string {
  if (status === 'warning') return HW_TEXT.warn;
  if (status === 'danger') return HW_TEXT.danger;
  if (domain === 'ph') return HW_TEXT.ph;
  if (domain === 'ec') return HW_TEXT.ec;
  return HW_TEXT.brand;
}

export default function SensorCard({
  title,
  value,
  unit,
  icon,
  status = 'normal',
  domain = 'brand',
}: SensorCardProps) {
  const accent = resolveAccent(status, domain);

  return (
    <InstrumentCard accent={accent} className="shadow-lg transition-all">
      <div className="flex items-center justify-between mb-2 -mt-1">
        <h3 className="text-lg font-medium text-dark-text">{title}</h3>
        {icon && <div className={HW_TEXT[accent]}>{icon}</div>}
      </div>
      <div className="flex items-end">
        <span className={`text-3xl font-bold tabular-nums ${valueColor(status, domain)}`}>
          {value}
        </span>
        {unit && <span className="ml-1 text-lg text-dark-textSecondary">{unit}</span>}
      </div>
      <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium border inline-block ${HW_BADGE[statusAccent[status]]}`}>
        {statusText[status]}
      </div>
    </InstrumentCard>
  );
}
