import React from 'react';

type SensorCardProps = {
  title: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  status?: 'normal' | 'warning' | 'danger';
};

export default function SensorCard({ title, value, unit, icon, status = 'normal' }: SensorCardProps) {
  const statusColors = {
    normal: 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  const statusText = {
    normal: 'Normal',
    warning: 'Aviso',
    danger: 'Perigo'
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-dark-text">{title}</h3>
        {icon && <div className="text-aqua-400">{icon}</div>}
      </div>
      <div className="flex items-end">
        <span className="text-3xl font-bold text-dark-text">{value}</span>
        {unit && <span className="ml-1 text-lg text-dark-textSecondary">{unit}</span>}
      </div>
      {status && (
        <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]} inline-block`}>
          {statusText[status]}
        </div>
      )}
    </div>
  );
} 