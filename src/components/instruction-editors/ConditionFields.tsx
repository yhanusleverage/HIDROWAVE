'use client';

import React from 'react';
import {
  WATER_LEVEL_OPTIONS,
  defaultConditionForSensor,
  getOperatorsForSensor,
  isLevelSensor,
} from '@/lib/instruction-labels';

export interface ConditionValue {
  sensor: string;
  operator: string;
  value: string | number;
}

interface ConditionFieldsProps {
  label?: string;
  condition: ConditionValue;
  onChange: (condition: ConditionValue) => void;
  sensors: Array<{ value: string; label: string }>;
}

export default function ConditionFields({
  label,
  condition,
  onChange,
  sensors,
}: ConditionFieldsProps) {
  const levelSensor = isLevelSensor(condition.sensor);
  const operators = getOperatorsForSensor(condition.sensor);

  const handleSensorChange = (newSensor: string) => {
    const defaults = defaultConditionForSensor(newSensor);
    onChange({
      sensor: newSensor,
      operator: defaults.operator,
      value: isLevelSensor(newSensor) ? defaults.value : 0,
    });
  };

  const numericPlaceholder =
    condition.sensor === 'humidity'
      ? 'Valor (%)'
      : condition.sensor === 'ph' || condition.sensor === 'ec'
        ? 'Valor'
        : condition.sensor === 'temperature' ||
            condition.sensor === 'temp_water' ||
            condition.sensor === 'temp_env'
          ? 'Valor (°C)'
          : 'Valor';

  return (
    <div className="border border-dark-border rounded-lg p-3 bg-dark-surface/30">
      {label && (
        <label className="block text-xs text-dark-textSecondary mb-2">{label}</label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <select
          value={condition.sensor}
          onChange={(e) => handleSensorChange(e.target.value)}
          className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
        >
          {sensors.map((sensor) => (
            <option key={sensor.value} value={sensor.value}>
              {sensor.label}
            </option>
          ))}
        </select>
        <select
          value={condition.operator}
          onChange={(e) =>
            onChange({ ...condition, operator: e.target.value })
          }
          className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        {levelSensor ? (
          <select
            value={String(condition.value || 'vazio')}
            onChange={(e) =>
              onChange({ ...condition, value: e.target.value })
            }
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          >
            {WATER_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step="0.1"
            value={condition.value ?? ''}
            onChange={(e) =>
              onChange({
                ...condition,
                value: parseFloat(e.target.value) || 0,
              })
            }
            placeholder={numericPlaceholder}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          />
        )}
      </div>
    </div>
  );
}
