import { supabase } from '@/lib/supabase';
import {
  addSharedChannelListener,
  type RealtimeChannelStatus,
} from '@/lib/realtime/channel';

export type AutoControllerTable = 'ec_config_view' | 'ph_config_view';

/** Fila que la web pinta en Auto EC / Auto pH. Solo claves presentes y válidas. */
export type ControllerConfigChange = {
  auto_enabled?: boolean;
  aggressiveness?: number;
  consumo_24h?: boolean;
  volume?: number;
  intervalo_auto_ec?: number;
  intervalo_auto_ph?: number;
  tempo_recirculacao?: number;
  pulse_ml?: number;
  pulse_gap_sec?: number;
  ec_setpoint?: number;
  tolerance?: number;
  ph_setpoint?: number;
  ph_tolerance?: number;
  relay_ph_up?: number | null;
  relay_ph_down?: number | null;
  flow_rate_ph_up?: number;
  flow_rate_ph_down?: number;
};

type AutoEnabledListener = {
  onChange: (row: ControllerConfigChange) => void;
  onStatus?: (status: RealtimeChannelStatus) => void;
};

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function relayOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n < 0 || n > 7) return undefined;
  return n;
}

/** Normaliza payload.new de Postgres. Una clave ausente no pisa el formulario. */
export function pickControllerConfigChange(
  raw: Record<string, unknown> | null | undefined
): ControllerConfigChange {
  if (!raw) return {};
  const out: ControllerConfigChange = {};
  if (typeof raw.auto_enabled === 'boolean') out.auto_enabled = raw.auto_enabled;
  if (typeof raw.consumo_24h === 'boolean') out.consumo_24h = raw.consumo_24h;
  const aggressiveness = finiteNumber(raw.aggressiveness);
  if (aggressiveness !== undefined) out.aggressiveness = aggressiveness;
  const volume = finiteNumber(raw.volume);
  if (volume !== undefined) out.volume = volume;
  const ivEc = finiteNumber(raw.intervalo_auto_ec);
  if (ivEc !== undefined) out.intervalo_auto_ec = ivEc;
  const ivPh = finiteNumber(raw.intervalo_auto_ph);
  if (ivPh !== undefined) out.intervalo_auto_ph = ivPh;
  const tempo = finiteNumber(raw.tempo_recirculacao);
  if (tempo !== undefined) out.tempo_recirculacao = tempo;
  const pulseMl = finiteNumber(raw.pulse_ml);
  if (pulseMl !== undefined) out.pulse_ml = pulseMl;
  const pulseGap = finiteNumber(raw.pulse_gap_sec);
  if (pulseGap !== undefined) out.pulse_gap_sec = pulseGap;
  const ecSp = finiteNumber(raw.ec_setpoint);
  if (ecSp !== undefined) out.ec_setpoint = ecSp;
  const tol = finiteNumber(raw.tolerance);
  if (tol !== undefined) out.tolerance = tol;
  const phSp = finiteNumber(raw.ph_setpoint);
  if (phSp !== undefined) out.ph_setpoint = phSp;
  const phTol = finiteNumber(raw.ph_tolerance);
  if (phTol !== undefined) out.ph_tolerance = phTol;
  const relayUp = relayOrNull(raw.relay_ph_up);
  if (relayUp !== undefined) out.relay_ph_up = relayUp;
  const relayDown = relayOrNull(raw.relay_ph_down);
  if (relayDown !== undefined) out.relay_ph_down = relayDown;
  const flowUp = finiteNumber(raw.flow_rate_ph_up);
  if (flowUp !== undefined) out.flow_rate_ph_up = flowUp;
  const flowDown = finiteNumber(raw.flow_rate_ph_down);
  if (flowDown !== undefined) out.flow_rate_ph_down = flowDown;
  return out;
}

export function configFieldChanged(
  prev: ControllerConfigChange,
  next: ControllerConfigChange,
  key: keyof ControllerConfigChange
): boolean {
  if (next[key] === undefined) return false;
  const a = prev[key];
  const b = next[key];
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) > 0.0001;
  return a !== b;
}

/**
 * Realtime de ec_config_view / ph_config_view.
 * El callback recibe la fila nueva. El panel aplica solo los campos que cambiaron
 * respecto a la última fila conocida, para no pisar un borrador con un evento ajeno.
 */
export function subscribeAutoEnabled(
  deviceId: string,
  table: AutoControllerTable,
  onChange: (row: ControllerConfigChange) => void,
  onStatus?: (status: RealtimeChannelStatus) => void
): () => void {
  if (!deviceId?.trim()) return () => {};

  const id = deviceId.trim();
  const channelName = `hidrowave-auto-${table}-${id}`;
  const listener: AutoEnabledListener = { onChange, onStatus };

  return addSharedChannelListener(channelName, listener, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `device_id=eq.${id}`,
        },
        (payload) => {
          const row = pickControllerConfigChange(
            (payload.new || payload.old) as Record<string, unknown> | null
          );
          if (Object.keys(row).length === 0) return;
          listeners.forEach((l) => l.onChange(row));
        }
      )
      .subscribe((status) => {
        const mapped: RealtimeChannelStatus =
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
            ? status
            : 'CLOSED';
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ${table} SUBSCRIBED —`, id);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            `[Realtime] ${table} CHANNEL_ERROR — activar replication (ENABLE_REALTIME_REPLICATION.sql)`
          );
        }
        listeners.forEach((l) => l.onStatus?.(mapped));
      })
  );
}
