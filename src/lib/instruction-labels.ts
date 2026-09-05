/**
 * Labels + helpers for sequential instruction editors.
 * LOOP / SWITCH stay technical IDs in type names; UI copy comes from `t.automacao.instr`.
 */

import type { AppTranslations } from '@/lib/translations/app/types';

export type InstrLabels = AppTranslations['automacao']['instr'];

export const INSTRUCTION_OPERATOR_VALUES = ['<', '>', '<=', '>=', '==', '!='] as const;
export const INSTRUCTION_OPERATOR_LEVEL_VALUES = ['==', '!='] as const;

export const WATER_LEVEL_VALUES_LIST = [
  'vazio',
  'baixo',
  'medio',
  'medio_alto',
  'alto',
] as const;

export const WATER_LEVEL_VALUES = new Set<string>(WATER_LEVEL_VALUES_LIST);

/** @deprecated Prefer getConditionSensors(instr) for localized labels. */
export const CONDITION_SENSORS = [
  { value: 'water_level', label: 'Nível de Água' },
  { value: 'temperature', label: 'Temperatura da Água (°C)' },
  { value: 'temp_water', label: 'Temp. Água (°C)' },
  { value: 'temp_env', label: 'Temp. Ambiente (°C)' },
  { value: 'humidity', label: 'Umidade (%)' },
  { value: 'ph', label: 'pH' },
  { value: 'ec', label: 'EC (µS/cm)' },
] as const;

/** @deprecated Prefer getWaterLevelOptions(instr). */
export const WATER_LEVEL_OPTIONS = [
  { value: 'vazio', label: '0/4 — Vazio' },
  { value: 'baixo', label: '1/4 — Baixo' },
  { value: 'medio', label: '2/4 — Médio' },
  { value: 'medio_alto', label: '3/4 — Médio alto' },
  { value: 'alto', label: '4/4 — Alto' },
] as const;

/** @deprecated Prefer getOperatorsForSensor(sensor, instr). */
export const INSTRUCTION_OPERATORS = [
  { value: '<', label: 'Menor que (<)' },
  { value: '>', label: 'Maior que (>)' },
  { value: '<=', label: 'Menor ou igual (≤)' },
  { value: '>=', label: 'Maior ou igual (≥)' },
  { value: '==', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
] as const;

/** @deprecated Prefer getOperatorsForSensor(sensor, instr). */
export const INSTRUCTION_OPERATORS_LEVEL = [
  { value: '==', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
] as const;

/** @deprecated Prefer instr.switchLabel / modeTimer / modeCycle. */
export const SWITCH_MODE_TIMER = 'Temporizador (duração fixa)';
export const SWITCH_MODE_CYCLE = 'Ciclo (liga/desliga automático)';
export const SWITCH_LABEL = 'SWITCH (trocar estado)';

/** @deprecated Prefer getInstructionTypeHints(instr). */
export const INSTRUCTION_TYPE_HINTS: Record<string, string> = {
  block_auto: 'Bloqueia Auto EC/pH enquanto o script corre (colocar no início)',
  unblock_auto: 'Libera Auto EC/pH (fim do procedimento ou cancelar)',
  while: 'LOOP — mantém ação até condição ou tempo máximo (ex.: dreno enquanto nível ≠ vazio)',
  if: 'Se — executa passos só se a condição for verdadeira',
  relay_action: 'Relé — liga ou desliga um relé master ou slave',
  switch: 'SWITCH — alterna estado do relé por tempo ou ciclo ON/OFF',
};

const LEGACY_LEVEL_TO_STATE: Record<string, string> = {
  level_1: 'vazio',
  level_2: 'medio',
  level_3: 'medio_alto',
  level_4: 'alto',
};

const OPERATOR_SYMBOLS: Record<string, string> = {
  '<': '<',
  '>': '>',
  '<=': '≤',
  '>=': '≥',
  '==': '=',
  '!=': '≠',
};

export interface InstructionPreviewInput {
  type: string;
  condition?: {
    sensor?: string;
    operator?: string;
    value?: string | number;
  };
  action?: 'on' | 'off' | 'toggle';
  relay_number?: number;
  duration_ms?: number;
  duration_seconds?: number;
}

export function isLevelSensor(sensor: string): boolean {
  return sensor === 'water_level';
}

export function normalizeConditionSensor(sensor: string): string {
  if (sensor.startsWith('level_')) return 'water_level';
  return sensor;
}

export function normalizeCondition(condition: {
  sensor?: string;
  operator?: string;
  value?: string | number | boolean;
}): { sensor: string; operator: string; value: string | number } {
  const rawSensor = String(condition.sensor ?? 'water_level');
  const sensor = normalizeConditionSensor(rawSensor);
  const operator = String(condition.operator ?? (isLevelSensor(sensor) ? '!=' : '>'));

  if (!isLevelSensor(sensor)) {
    const num =
      typeof condition.value === 'number'
        ? condition.value
        : parseFloat(String(condition.value ?? '0')) || 0;
    return { sensor, operator, value: num };
  }

  const strVal = String(condition.value ?? '').toLowerCase();
  if (WATER_LEVEL_VALUES.has(strVal)) {
    return { sensor, operator, value: strVal };
  }

  if (rawSensor.startsWith('level_')) {
    const mapped = LEGACY_LEVEL_TO_STATE[rawSensor] ?? 'vazio';
    return { sensor, operator, value: mapped };
  }

  return { sensor, operator, value: 'vazio' };
}

export function getConditionSensors(instr: InstrLabels): Array<{ value: string; label: string }> {
  return [
    { value: 'water_level', label: instr.sensorWaterLevel },
    { value: 'temperature', label: instr.sensorTemperature },
    { value: 'temp_water', label: instr.sensorTempWater },
    { value: 'temp_env', label: instr.sensorTempEnv },
    { value: 'humidity', label: instr.sensorHumidity },
    { value: 'ph', label: instr.sensorPh },
    { value: 'ec', label: instr.sensorEc },
  ];
}

export function getWaterLevelOptions(instr: InstrLabels): Array<{ value: string; label: string }> {
  return [
    { value: 'vazio', label: instr.levelVazio },
    { value: 'baixo', label: instr.levelBaixo },
    { value: 'medio', label: instr.levelMedio },
    { value: 'medio_alto', label: instr.levelMedioAlto },
    { value: 'alto', label: instr.levelAlto },
  ];
}

export function getOperatorsForSensor(
  sensor: string,
  instr?: InstrLabels
): Array<{ value: string; label: string }> {
  if (!instr) {
    return isLevelSensor(sensor)
      ? [...INSTRUCTION_OPERATORS_LEVEL]
      : [...INSTRUCTION_OPERATORS];
  }
  const all = [
    { value: '<', label: instr.opLt },
    { value: '>', label: instr.opGt },
    { value: '<=', label: instr.opLte },
    { value: '>=', label: instr.opGte },
    { value: '==', label: instr.opEq },
    { value: '!=', label: instr.opNeq },
  ];
  if (isLevelSensor(sensor)) {
    return all.filter((o) => o.value === '==' || o.value === '!=');
  }
  return all;
}

export function defaultConditionForSensor(sensor: string): {
  sensor: string;
  operator: string;
  value: string;
} {
  if (isLevelSensor(sensor)) {
    return { sensor, operator: '!=', value: 'vazio' };
  }
  return { sensor, operator: '>', value: '0' };
}

export function formatSensorLabel(sensor: string, instr?: InstrLabels): string {
  if (!instr) {
    const fallback: Record<string, string> = {
      water_level: 'Nível de água',
      temperature: 'Temperatura da água',
      temp_water: 'Temp. água',
      temp_env: 'Temp. ambiente',
      humidity: 'Umidade',
      ph: 'pH',
      ec: 'EC',
    };
    return fallback[sensor] ?? sensor;
  }
  const map: Record<string, string> = {
    water_level: instr.sensorWaterLevelShort,
    temperature: instr.sensorTemperatureShort,
    temp_water: instr.sensorTempWaterShort,
    temp_env: instr.sensorTempEnvShort,
    humidity: instr.sensorHumidityShort,
    ph: instr.sensorPh,
    ec: 'EC',
  };
  return map[sensor] ?? sensor;
}

export function formatConditionValue(
  sensor: string,
  value: string | number | undefined,
  instr?: InstrLabels
): string {
  if (value === undefined || value === null) return '';
  if (isLevelSensor(sensor) && typeof value === 'string') {
    const options = instr ? getWaterLevelOptions(instr) : [...WATER_LEVEL_OPTIONS];
    const level = options.find((o) => o.value === value);
    return level?.label ?? value;
  }
  return String(value);
}

export function formatConditionPhrase(
  condition?: InstructionPreviewInput['condition'],
  instr?: InstrLabels
): string {
  if (!condition?.sensor) return '';
  const normalized = normalizeCondition(condition);
  const sensor = formatSensorLabel(normalized.sensor, instr);
  const op = OPERATOR_SYMBOLS[normalized.operator] ?? normalized.operator;
  const val = formatConditionValue(normalized.sensor, normalized.value, instr);
  return `${sensor} ${op} ${val}`.trim();
}

export function formatInstructionType(type: string, instr?: InstrLabels): string {
  if (!instr) {
    switch (type) {
      case 'block_auto':
        return 'Bloquear Auto';
      case 'unblock_auto':
        return 'Liberar Auto';
      case 'while':
        return 'LOOP';
      case 'if':
        return 'Se';
      case 'relay_action':
        return 'Relé';
      case 'switch':
        return 'SWITCH';
      case 'return':
        return 'Retornar';
      case 'delay':
        return 'Espera';
      case 'break':
        return 'Sair';
      case 'continue':
        return 'Continuar';
      default:
        return type;
    }
  }
  switch (type) {
    case 'block_auto':
      return instr.typeBlockAuto;
    case 'unblock_auto':
      return instr.typeUnblockAuto;
    case 'while':
      return instr.typeWhile;
    case 'if':
      return instr.typeIf;
    case 'relay_action':
      return instr.typeRelay;
    case 'switch':
      return instr.typeSwitch;
    case 'return':
      return instr.typeReturn;
    case 'delay':
      return instr.typeDelay;
    case 'break':
      return instr.typeBreak;
    case 'continue':
      return instr.typeContinue;
    default:
      return type;
  }
}

export function getInstructionTypeHints(instr: InstrLabels): Record<string, string> {
  return {
    block_auto: instr.hintBlockAuto,
    unblock_auto: instr.hintUnblockAuto,
    while: instr.hintWhile,
    if: instr.hintIf,
    relay_action: instr.hintRelay,
    switch: instr.hintSwitch,
  };
}

export function formatInstructionPreview(
  preview: InstructionPreviewInput,
  instr?: InstrLabels
): string {
  const label = formatInstructionType(preview.type, instr);

  if (preview.type === 'block_auto' || preview.type === 'unblock_auto') {
    return label;
  }

  if (preview.type === 'while' || preview.type === 'if') {
    const phrase = formatConditionPhrase(
      preview.condition ? normalizeCondition(preview.condition) : undefined,
      instr
    );
    return phrase ? `${label}: ${phrase}` : label;
  }

  if (preview.type === 'relay_action') {
    const state =
      preview.action === 'on' ? 'ON' : preview.action === 'off' ? 'OFF' : 'TOGGLE';
    const relay =
      preview.relay_number !== undefined ? ` ${preview.relay_number}` : '';
    return `${label}${relay} (${state})`;
  }

  if (preview.type === 'switch') {
    const relay =
      preview.relay_number !== undefined ? ` ${preview.relay_number}` : '';
    return relay ? `${label}${relay}` : label;
  }

  if (preview.type === 'delay') {
    const ms = preview.duration_ms ?? 0;
    const sec = ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
    return `${label} ${sec}`;
  }

  return label;
}
