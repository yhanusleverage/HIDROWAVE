import { supabase } from '@/lib/supabase';
import type { EnvironmentMeasurement, HydroMeasurement } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Realtime para tarjetas de sensores en dashboard (última medición).
 * El histórico de gráficos sigue con fetch REST periódico.
 */
export function subscribeSensorMeasurements(
  deviceId: string | undefined,
  handlers: {
    onHydro?: (row: HydroMeasurement) => void;
    onEnvironment?: (row: EnvironmentMeasurement) => void;
  }
): () => void {
  const channelName = deviceId
    ? `hidrowave-sensors-${deviceId}`
    : 'hidrowave-sensors-all';
  let channel: RealtimeChannel | null = null;

  const hydroFilter = deviceId ? `device_id=eq.${deviceId}` : undefined;
  const envFilter = deviceId ? `device_id=eq.${deviceId}` : undefined;

  channel = supabase.channel(channelName);

  if (handlers.onHydro) {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'hydro_measurements',
        ...(hydroFilter ? { filter: hydroFilter } : {}),
      },
      (payload) => {
        const row = payload.new as HydroMeasurement;
        if (row) handlers.onHydro!(row);
      }
    );
  }

  if (handlers.onEnvironment) {
    channel = channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'environment_data',
        ...(envFilter ? { filter: envFilter } : {}),
      },
      (payload) => {
        const row = payload.new as EnvironmentMeasurement;
        if (row) handlers.onEnvironment!(row);
      }
    );
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] hydro/environment SUBSCRIBED', deviceId ?? 'all');
    }
    if (status === 'CHANNEL_ERROR') {
      console.warn('[Realtime] sensors CHANNEL_ERROR — activar replication');
    }
  });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}
