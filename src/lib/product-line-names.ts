/**
 * Línea comercial HydroWave — Core · Atlas · Pulse.
 * Solo displayName / subtítulos para UI y docs de operador.
 * IDs técnicos (master / slave / doser) y MQTT no cambian.
 *
 * Fuente: docs/handoffs/MODULE_NAMING_PRODUCT_LINE.md
 */

export type ProductLineRole = 'core' | 'atlas' | 'pulse';

export type ProductLineLocale = 'pt-BR' | 'es' | 'en';

export interface ProductLineModule {
  role: ProductLineRole;
  /** ID técnico / MQTT — no usar en copy comercial */
  technicalId: 'master' | 'slave' | 'doser';
  /** Nombre corto UI */
  shortName: string;
  /** Nombre comercial completo */
  displayName: string;
  subtitle: string;
  tagline: Record<ProductLineLocale, string>;
}

export const PRODUCT_LINE = {
  core: {
    role: 'core',
    technicalId: 'master',
    shortName: 'Core',
    displayName: 'HydroWave Core',
    subtitle: 'Controlador central',
    tagline: {
      'pt-BR': 'O cérebro do tanque. Sensores, regras e rede em uma caixa.',
      es: 'El cerebro del tanque. Sensores, reglas y red en una caja.',
      en: 'The brain of your tank. Sensors, rules, and network in one box.',
    },
  },
  atlas: {
    role: 'atlas',
    technicalId: 'slave',
    shortName: 'Atlas',
    displayName: 'HydroWave Atlas',
    subtitle: 'Relés e válvulas',
    tagline: {
      'pt-BR': 'Sustenta a carga do campo. Válvulas, bombas e relés sob comando.',
      es: 'Soporta la carga de campo. Válvulas, bombas y relés bajo control.',
      en: 'Carries the field load. Valves, pumps, and relays on command.',
    },
  },
  pulse: {
    role: 'pulse',
    technicalId: 'doser',
    shortName: 'Pulse',
    displayName: 'HydroWave Pulse',
    subtitle: 'Módulo dosador pH/EC',
    tagline: {
      'pt-BR': 'O pulso do nutriente. pH e EC na proporção certa.',
      es: 'El pulso del nutriente. pH y EC en la proporción exacta.',
      en: 'The pulse of nutrients. pH and EC in exact proportion.',
    },
  },
} as const satisfies Record<ProductLineRole, ProductLineModule>;

export function productLineModule(role: ProductLineRole): ProductLineModule {
  return PRODUCT_LINE[role];
}

/** Display comercial a partir del rol técnico MQTT/API. */
export function displayNameForTechnicalId(
  technicalId: string | null | undefined
): string {
  const id = (technicalId ?? '').toLowerCase();
  if (id === 'master' || id.includes('master')) return PRODUCT_LINE.core.displayName;
  if (id === 'slave' || id === 'relay_node' || id.includes('slave')) {
    return PRODUCT_LINE.atlas.displayName;
  }
  if (id === 'doser' || id.includes('doser')) return PRODUCT_LINE.pulse.displayName;
  return technicalId?.trim() || 'HydroWave';
}
