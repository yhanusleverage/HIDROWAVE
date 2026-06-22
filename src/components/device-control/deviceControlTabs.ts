/**
 * Subcomponentes do painel de controle por dispositivo.
 * O conteúdo de cada aba permanece em DeviceControlPanel.tsx;
 * use estes ids ao navegar por teclado / testes e2e.
 */
export const DEVICE_CONTROL_TABS = ['status', 'rules', 'local', 'slaves'] as const;
export type DeviceControlTab = (typeof DEVICE_CONTROL_TABS)[number];

export function deviceTabPanelId(tab: DeviceControlTab): string {
  return `device-panel-${tab}`;
}

export function deviceTabButtonId(tab: DeviceControlTab): string {
  return `device-tab-${tab}`;
}
