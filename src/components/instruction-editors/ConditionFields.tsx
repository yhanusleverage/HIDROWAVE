'use client';

import React from 'react';
import {
  defaultConditionForSensor,
  getOperatorsForSensor,
  getWaterLevelOptions,
  isLevelSensor,
} from '@/lib/instruction-labels';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const instrT = t.automacao.instr;
  const levelSensor = isLevelSensor(condition.sensor);
  const operators = getOperatorsForSensor(condition.sensor, instrT);
  const waterLevels = getWaterLevelOptions(instrT);

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
      ? instrT.valuePercent
      : condition.sensor === 'ph' || condition.sensor === 'ec'
        ? instrT.valuePlaceholder
        : condition.sensor === 'temperature' ||
            condition.sensor === 'temp_water' ||
            condition.sensor === 'temp_env'
          ? instrT.valueCelsius
          : instrT.valuePlaceholder;

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
            value={String(condition.value)}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          >
            {waterLevels.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step="any"
            value={condition.value}
            onChange={(e) =>
              onChange({
                ...condition,
                value: e.target.value === '' ? 0 : Number(e.target.value),
              })
            }
            placeholder={numericPlaceholder}
            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-aqua-500"
          />
        )}
      </div>
    </div>
  );
}
