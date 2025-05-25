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
    normal: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  const statusText = {
    normal: 'Normal',
    warning: 'Advertencia',
    danger: 'Peligro'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-gray-700">{title}</h3>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <div className="flex items-end">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="ml-1 text-lg text-gray-500">{unit}</span>}
      </div>
      {status && (
        <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]} inline-block`}>
          {statusText[status]}
        </div>
      )}
    </div>
  );
} 