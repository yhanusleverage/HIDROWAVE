/** Rótulos PT-BR do editor de instruções — manter em inglês apenas LOOP e SWITCH. */

export const INSTRUCTION_OPERATORS = [
  { value: '<', label: 'Menor que (<)' },
  { value: '>', label: 'Maior que (>)' },
  { value: '<=', label: 'Menor ou igual (≤)' },
  { value: '>=', label: 'Maior ou igual (≥)' },
  { value: '==', label: 'Igual (=)' },
  { value: '!=', label: 'Diferente (≠)' },
] as const;

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

export const SWITCH_MODE_TIMER = 'Temporizador (duração fixa)';
export const SWITCH_MODE_CYCLE = 'Ciclo (liga/desliga automático)';
export const SWITCH_LABEL = 'SWITCH (trocar estado)';
