/**
 * Helpers compartilhados — POST config EC/pH (strip, sanitize, parse erro).
 */

export const EC_WRITABLE_KEYS = [
  'base_dose',
  'flow_rate',
  'volume',
  'total_ml',
  'kp',
  'ec_setpoint',
  'tolerance',
  'auto_enabled',
  'intervalo_auto_ec',
  'tempo_recirculacao',
  'nutrients',
  'distribution',
  'dilution_auto_enabled',
  'dilution_drain_relay',
  'dilution_fill_relay',
  'dilution_drain_slave_mac',
  'dilution_fill_slave_mac',
  'dilution_max_volume_l',
  'flowmeter_pulses_per_liter',
  'dilution_fill_flow_lps',
  'updated_at',
  'created_by',
] as const;

export const PH_WRITABLE_KEYS = [
  'ph_setpoint',
  'ph_tolerance',
  'flow_rate_ph_up',
  'flow_rate_ph_down',
  'volume',
  'ml_per_ph_unit',
  'ml_per_ph_unit_acid',
  'ml_per_ph_unit_base',
  'relay_ph_up',
  'relay_ph_down',
  'auto_enabled',
  'intervalo_auto_ph',
  'tempo_recirculacao',
  'aggressiveness',
  'gain_alpha',
  'max_dose_ml_per_cycle',
  'max_pulse_seconds',
  'max_consecutive_corrections',
  'reset_k_gains',
  'updated_at',
  'created_by',
] as const;

function pickKeys(
  config: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in config && config[key] !== undefined) {
      out[key] = config[key];
    }
  }
  return out;
}

function finiteFloat(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function positiveInt(value: unknown, min = 1): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const n = Math.floor(value);
  return n >= min ? n : min;
}

/** Remove chaves read-only / debug antes do whitelist. */
function omitKeys(
  config: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out = { ...config };
  for (const key of keys) {
    delete out[key];
  }
  return out;
}

/** Remove id, created_at, _debug e campos fora da whitelist EC. */
export function stripEcWritableConfig(
  config: Record<string, unknown>
): Record<string, unknown> {
  const withoutMeta = omitKeys(config, [
    'id',
    'created_at',
    '_debug',
    'device_id',
  ]);
  return pickKeys(withoutMeta, EC_WRITABLE_KEYS);
}

/** Remove id, created_at, k_* aprendidos, _debug e campos fora da whitelist pH. */
export function stripPhWritableConfig(
  config: Record<string, unknown>
): Record<string, unknown> {
  const withoutMeta = omitKeys(config, [
    'id',
    'created_at',
    'k_acid',
    'k_base',
    '_debug',
    'device_id',
  ]);
  return pickKeys(withoutMeta, PH_WRITABLE_KEYS);
}

/** Garante CHECK constraints ec_config_view (intervalo/tempo > 0). */
export function sanitizeEcNumericFields(
  config: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...config };

  for (const key of ['base_dose', 'flow_rate', 'volume', 'total_ml', 'kp', 'ec_setpoint', 'tolerance', 'dilution_max_volume_l', 'flowmeter_pulses_per_liter', 'dilution_fill_flow_lps'] as const) {
    const v = finiteFloat(out[key]);
    if (v !== undefined) out[key] = v;
  }

  if (out.dilution_drain_relay !== undefined && typeof out.dilution_drain_relay === 'number') {
    out.dilution_drain_relay = Math.floor(out.dilution_drain_relay);
  }
  if (out.dilution_fill_relay !== undefined && typeof out.dilution_fill_relay === 'number') {
    out.dilution_fill_relay = Math.floor(out.dilution_fill_relay);
  }

  for (const key of ['dilution_drain_slave_mac', 'dilution_fill_slave_mac'] as const) {
    if (typeof out[key] === 'string') {
      const trimmed = (out[key] as string).trim().toUpperCase();
      out[key] = trimmed.length > 0 ? trimmed : null;
    }
  }

  if (out.intervalo_auto_ec !== undefined) {
    out.intervalo_auto_ec = positiveInt(out.intervalo_auto_ec as number, 1);
  }
  if (out.tempo_recirculacao !== undefined) {
    out.tempo_recirculacao = positiveInt(out.tempo_recirculacao as number, 1);
  }

  return out;
}

/** Garante CHECK constraints ph_config_view. */
export function sanitizePhNumericFields(
  config: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...config };

  for (const key of [
    'ph_setpoint',
    'ph_tolerance',
    'flow_rate_ph_up',
    'flow_rate_ph_down',
    'volume',
    'ml_per_ph_unit',
    'ml_per_ph_unit_acid',
    'ml_per_ph_unit_base',
    'max_dose_ml_per_cycle',
  ] as const) {
    const v = finiteFloat(out[key]);
    if (v !== undefined) out[key] = v;
  }

  if (out.intervalo_auto_ph !== undefined) {
    out.intervalo_auto_ph = positiveInt(out.intervalo_auto_ph as number, 1);
  }
  if (out.tempo_recirculacao !== undefined) {
    out.tempo_recirculacao = positiveInt(out.tempo_recirculacao as number, 1);
  }

  if (typeof out.relay_ph_up === 'number') out.relay_ph_up = Math.floor(out.relay_ph_up);
  if (typeof out.relay_ph_down === 'number') out.relay_ph_down = Math.floor(out.relay_ph_down);

  return out;
}

export interface ParsedConfigApiError {
  message: string;
  status: number;
  body: Record<string, unknown>;
}

/** Parse resposta de erro — nunca devolve message vazio. */
export async function parseConfigApiError(
  response: Response
): Promise<ParsedConfigApiError> {
  const status = response.status;
  let body: Record<string, unknown> = {};
  let rawText = '';

  try {
    rawText = await response.text();
    if (rawText.trim()) {
      body = JSON.parse(rawText) as Record<string, unknown>;
    }
  } catch {
    body = rawText.trim() ? { raw: rawText.slice(0, 500) } : {};
  }

  const fromBody =
    (typeof body.error === 'string' && body.error) ||
    (typeof body.message === 'string' && body.message) ||
    (typeof body.raw === 'string' && body.raw) ||
    '';

  const message =
    fromBody ||
    `HTTP ${status}${response.statusText ? `: ${response.statusText}` : ''}`;

  return { message, status, body };
}

/** Resposta JSON padronizada para rotas API (server). */
export function configApiErrorResponse(
  error: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return {
    error: error || 'Erro desconhecido',
    ...extra,
  };
}
