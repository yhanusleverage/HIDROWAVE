import type { RuleProcedure } from '../types';

export const INITIAL_FILL_DEMO: RuleProcedure = {
  id: 'INITIAL_FILL',
  name: 'Initial Fill',
  description: 'Demo Aurora: janela matinal, sensor valve de nivel, circulacao e mix.',
  priority: 90,
  layer: 'P1',
  enabled: true,
  triggers: [
    {
      type: 'time_window',
      start: '08:00',
      end: '09:00',
      timezone: 'America/Sao_Paulo',
    },
  ],
  steps: [
    {
      type: 'sensor_valve',
      id: 'fill-valve',
      label: 'Encher até nível alto',
      roleId: 'fill_valve',
      actuator: {
        target: 'slave',
        relayIndex: 0,
        slaveMac: '',
        label: 'Válvula de enchimento',
      },
      sensor: { sensor: 'water_level', operator: '!=', value: 'alto' },
      valveStart: 'open',
      valveFinish: 'closed',
      maxDurationMs: 10 * 60 * 1000,
    },
    {
      type: 'set_relay',
      id: 'circ-pump',
      label: 'Bomba circulação ON',
      roleId: 'circulation_pump',
      actuator: {
        target: 'slave',
        relayIndex: 0,
        slaveMac: '',
        label: 'Bomba de circulação',
      },
      state: 'on',
      durationSeconds: 300,
    },
    {
      type: 'wait',
      id: 'mix-wait',
      label: 'Mix delay',
      durationMs: 5 * 60 * 1000,
    },
  ],
  chain: [
    {
      targetRuleId: 'AUTO_EC_RESUME',
      on: 'success',
      delayMs: 0,
    },
  ],
  safety: [
    {
      id: 'hold-ec-ph',
      description: 'Pausar Auto EC/pH durante Initial Fill (P1).',
    },
  ],
};

export function cloneInitialFillDemo(): RuleProcedure {
  return JSON.parse(JSON.stringify(INITIAL_FILL_DEMO)) as RuleProcedure;
}
