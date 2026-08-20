/**
 * Rótulos PT-BR do editor de instruções sequenciais.
 * Manter em inglês apenas LOOP e SWITCH (identidade técnica no Motor de Decisão).
 * Tipos JSON/firmware permanecem while, switch, relay_action, etc.
 */

export const INSTRUCTION_OPERATORS = [
  { value: '<', label: 'Menor que (<)' },
  { value: '>', label: 'Maior que (>)' },
  { value: '<=', label: 'Menor ou igual (≤)' },
  { value: '>=', label: 'Maior ou igual (≥)' },
  { value: '==', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
] as const;

export const INSTRUCTION_OPERATORS_LEVEL = [
  { value: '==', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
] as const;

export const WATER_LEVEL_OPTIONS = [
  { value: 'vazio', label: '0/4 — Vazio' },
  { value: 'baixo', label: '1/4 — Baixo' },
  { value: 'medio', label: '2/4 — Médio' },
  { value: 'medio_alto', label: '3/4 — Médio alto' },
  { value: 'alto', label: '4/4 — Alto' },
] as const;

export const WATER_LEVEL_VALUES = new Set(WATER_LEVEL_OPTIONS.map((o) => o.value));

/** Sensores disponíveis em condições de regras e scripts. */
export const CONDITION_SENSORS = [
  { value: 'water_level', label: 'Nível de Água' },
  { value: 'temperature', label: 'Temperatura da Água (°C)' },
  { value: 'temp_water', label: 'Temp. Água (°C)' },
  { value: 'temp_env', label: 'Temp. Ambiente (°C)' },
  { value: 'humidity', label: 'Umidade (%)' },
  { value: 'ph', label: 'pH' },
  { value: 'ec', label: 'EC (µS/cm)' },
] as const;

const SENSOR_LABELS: Record<string, string> = {
  water_level: 'Nível de água',
  temperature: 'Temperatura da água',
  temp_water: 'Temp. água',
  temp_env: 'Temp. ambiente',
  humidity: 'Umidade',
  ph: 'pH',
  ec: 'EC',
};

/** Mapeamento legado level_1–4 → water_level (V2: L1=base/vazio … L4=topo/alto). */
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

/** Converte level_1–4 (legado) para water_level + estado vazio/baixo/medio/alto. */
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
  if ((WATER_LEVEL_VALUES as Set<string>).has(strVal)) {
    return { sensor, operator, value: strVal };
  }

  if (rawSensor.startsWith('level_')) {
    const mapped = LEGACY_LEVEL_TO_STATE[rawSensor] ?? 'vazio';
    return { sensor, operator, value: mapped };
  }

  return { sensor, operator, value: 'vazio' };
}

export function getOperatorsForSensor(sensor: string) {
  return isLevelSensor(sensor) ? INSTRUCTION_OPERATORS_LEVEL : INSTRUCTION_OPERATORS;
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

export function formatSensorLabel(sensor: string): string {
  return SENSOR_LABELS[sensor] ?? sensor;
}

export function formatConditionValue(sensor: string, value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  if (isLevelSensor(sensor) && typeof value === 'string') {
    const level = WATER_LEVEL_OPTIONS.find((o) => o.value === value);
    return level?.label ?? value;
  }
  return String(value);
}

export function formatConditionPhrase(condition?: InstructionPreviewInput['condition']): string {
  if (!condition?.sensor) return '';
  const normalized = normalizeCondition(condition);
  const sensor = formatSensorLabel(normalized.sensor);
  const op = OPERATOR_SYMBOLS[normalized.operator] ?? normalized.operator;
  const val = formatConditionValue(normalized.sensor, normalized.value);
  return `${sensor} ${op} ${val}`.trim();
}

/** Rótulo curto do tipo de instrução (UI + Motor de Decisão). */
export function formatInstructionType(type: string): string {
  switch (type) {
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

/** Dica curta para botões de adicionar instrução. */
export const INSTRUCTION_TYPE_HINTS: Record<string, string> = {
  while: 'LOOP — mantém ação até condição ou tempo máximo (ex.: dreno enquanto nível ≠ vazio)',
  if: 'Se — executa passos só se a condição for verdadeira',
  relay_action: 'Relé — liga ou desliga um relé master ou slave',
  switch: 'SWITCH — alterna estado do relé por tempo ou ciclo ON/OFF',
};

/** Frase legível para cards e previews do Motor de Decisão. */
export function formatInstructionPreview(instr: InstructionPreviewInput): string {
  const label = formatInstructionType(instr.type);

  if (instr.type === 'while' || instr.type === 'if') {
    const phrase = formatConditionPhrase(
      instr.condition ? normalizeCondition(instr.condition) : undefined
    );
    return phrase ? `${label}: ${phrase}` : label;
  }

  if (instr.type === 'relay_action') {
    const state =
      instr.action === 'on' ? 'ON' : instr.action === 'off' ? 'OFF' : 'TOGGLE';
    const relay =
      instr.relay_number !== undefined ? ` ${instr.relay_number}` : '';
    return `${label}${relay} (${state})`;
  }

  if (instr.type === 'switch') {
    const relay =
      instr.relay_number !== undefined ? ` relé ${instr.relay_number}` : '';
    return relay ? `${label}${relay}` : label;
  }

  if (instr.type === 'delay') {
    const ms = instr.duration_ms ?? 0;
    const sec = ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
    return `${label} ${sec}`;
  }

  return label;
}

export const SWITCH_MODE_TIMER = 'Temporizador (duração fixa)';
export const SWITCH_MODE_CYCLE = 'Ciclo (liga/desliga automático)';
export const SWITCH_LABEL = 'SWITCH (trocar estado)';
