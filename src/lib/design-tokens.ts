/**
 * HydroWave design tokens — color semântico (intenção antes de hex).
 * Componentes devem referenciar estes mapas, não cores Tailwind soltas.
 */

export type HwAccent = 'brand' | 'ec' | 'ph' | 'wait' | 'warn' | 'danger' | 'ok' | 'neutral';

export type HwMetricVariant = 'default' | 'live' | 'setpoint' | 'preview' | 'alarm' | 'ok' | 'danger';

/** Línea superior 2px (InstrumentCard) e barra lateral 4px (SectionHeader). */
export const HW_ACCENT_TOP: Record<HwAccent, string> = {
  brand: 'border-t-aqua-500',
  ec: 'border-t-emerald-500',
  ph: 'border-t-violet-500',
  wait: 'border-t-cyan-500',
  warn: 'border-t-amber-500',
  danger: 'border-t-red-500',
  ok: 'border-t-green-500',
  neutral: 'border-t-dark-border',
};

export const HW_ACCENT_LEFT: Record<HwAccent, string> = {
  brand: 'border-l-aqua-500',
  ec: 'border-l-emerald-500',
  ph: 'border-l-violet-500',
  wait: 'border-l-cyan-500',
  warn: 'border-l-amber-500',
  danger: 'border-l-red-500',
  ok: 'border-l-green-500',
  neutral: 'border-l-dark-border',
};

export const HW_TEXT: Record<HwAccent, string> = {
  brand: 'text-aqua-400',
  ec: 'text-emerald-400',
  ph: 'text-violet-400',
  wait: 'text-cyan-400',
  warn: 'text-amber-400',
  danger: 'text-red-400',
  ok: 'text-green-400',
  neutral: 'text-dark-text',
};

export const HW_BG_SUBTLE: Record<HwAccent, string> = {
  brand: 'bg-aqua-500/5 border-aqua-500/25',
  ec: 'bg-emerald-500/5 border-emerald-500/25',
  ph: 'bg-violet-500/5 border-violet-500/25',
  wait: 'bg-cyan-500/5 border-cyan-500/25',
  warn: 'bg-amber-500/5 border-amber-500/25',
  danger: 'bg-red-500/5 border-red-500/25',
  ok: 'bg-green-500/5 border-green-500/25',
  neutral: 'bg-dark-surface border-dark-border',
};

export const HW_BADGE: Record<HwAccent, string> = {
  brand: 'bg-aqua-500/15 text-aqua-400 border-aqua-500/40',
  ec: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  ph: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  wait: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  warn: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  danger: 'bg-red-500/10 text-red-400 border-red-500/30',
  ok: 'bg-green-500/15 text-green-400 border-green-500/40',
  neutral: 'bg-dark-surface text-dark-textSecondary border-dark-border',
};

export const HW_BANNER: Record<HwAccent, string> = {
  brand: 'bg-aqua-500/15 border-aqua-500/40',
  ec: 'bg-emerald-500/15 border-emerald-500/40',
  ph: 'bg-violet-500/15 border-violet-500/40',
  wait: 'bg-cyan-500/15 border-cyan-500/40',
  warn: 'bg-amber-500/15 border-amber-500/40',
  danger: 'bg-red-500/10 border-red-500/30',
  ok: 'bg-green-500/15 border-green-500/40',
  neutral: 'bg-dark-surface border-dark-border',
};

/** Valor numérico em MetricRow. */
export const HW_METRIC_VALUE: Record<HwMetricVariant, string> = {
  default: 'text-dark-text font-medium tabular-nums',
  live: 'text-aqua-400 font-medium tabular-nums',
  setpoint: 'text-violet-400 font-medium tabular-nums',
  preview: 'text-violet-400 font-medium tabular-nums',
  alarm: 'text-amber-400 font-medium tabular-nums',
  ok: 'text-green-400 font-medium tabular-nums',
  danger: 'text-red-400 font-medium tabular-nums',
};

/** Tint de ícone por rota do sidebar. */
export const HW_NAV_ICON_TINT: Record<string, HwAccent> = {
  '/dashboard': 'brand',
  '/automacao': 'brand',
  '/calibragem': 'ph',
  '/dispositivos': 'wait',
  '/configuracao': 'neutral',
  '/fundamentos': 'neutral',
  '/support': 'brand',
  '/processos': 'wait',
  '/informacao': 'wait',
  '/planos': 'brand',
};

/** Owner de relé → acento. */
export const HW_RELAY_OWNER_ACCENT: Record<string, HwAccent> = {
  ec_nutrient: 'ec',
  ec_dilution_drain: 'ec',
  ec_dilution_fill: 'ec',
  ph_up: 'ph',
  ph_down: 'ph',
  runtime_active: 'wait',
  calibragem: 'ph',
  decision_rule: 'brand',
  manual: 'warn',
};

/** Categoria ControlToast → acento do badge. */
export const HW_TOAST_CATEGORY_ACCENT: Record<string, HwAccent> = {
  SISTEMA: 'brand',
  RELÉ: 'warn',
  'AUTO EC': 'ec',
  'DILUIÇÃO EC': 'ec',
  'AUTO PH': 'ph',
  REGRA: 'brand',
  DISPOSITIVO: 'wait',
  CALIBRAGEM: 'ph',
  ALERTA: 'warn',
};

/** Escala tipográfica unificada. */
export const HW_HEADING_LG = 'text-3xl font-bold text-dark-text';
export const HW_HEADING_MD = 'text-2xl font-bold text-dark-text';
export const HW_HEADING_SM = 'text-lg font-semibold text-dark-text';
export const HW_LABEL = 'text-sm text-dark-textSecondary';
export const HW_METRIC = 'text-3xl font-bold tabular-nums text-dark-text';
export const HW_BODY = 'text-base text-dark-text';

export function hwNavActiveClasses(isActive: boolean): string {
  return isActive
    ? 'bg-aqua-500/15 border-l-4 border-l-aqua-500 text-aqua-100'
    : 'border-l-4 border-l-transparent hover:bg-dark-card/80 hover:border-l-aqua-500/30';
}

export function hwNavIconClasses(href: string, isActive: boolean): string {
  if (isActive) return 'text-aqua-300';
  const accent = HW_NAV_ICON_TINT[href] ?? 'neutral';
  return HW_TEXT[accent];
}
