/**
 * Subcomponentes do painel de controle por dispositivo.
 * O modal exibe apenas a vista Status.
 */
export const DEVICE_CONTROL_TABS = ['status'] as const;
export type DeviceControlTab = (typeof DEVICE_CONTROL_TABS)[number];

export function deviceTabPanelId(tab: DeviceControlTab): string {
  return `device-panel-${tab}`;
}

export function deviceTabButtonId(tab: DeviceControlTab): string {
  return `device-tab-${tab}`;
}
