import { supabase } from '@/lib/supabase';
import type { EnvironmentMeasurement, HydroMeasurement } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

type SensorMeasurementsListener = {
  onHydro?: (row: HydroMeasurement) => void;
  onEnvironment?: (row: EnvironmentMeasurement) => void;
};

/**
 * Realtime para tarjetas de sensores en dashboard (última medición).
 * El histórico de gráficos sigue con fetch REST periódico.
 */
export function subscribeSensorMeasurements(
  deviceId: string | undefined,
  handlers: SensorMeasurementsListener
): () => void {
  const channelName = deviceId
    ? `hidrowave-sensors-${deviceId}`
    : 'hidrowave-sensors-all';

  const hydroFilter = deviceId ? `device_id=eq.${deviceId}` : undefined;
  const envFilter = deviceId ? `device_id=eq.${deviceId}` : undefined;

  return addSharedChannelListener(channelName, handlers, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hydro_measurements',
          ...(hydroFilter ? { filter: hydroFilter } : {}),
        },
        (payload) => {
          const row = payload.new as HydroMeasurement;
          if (!row) return;
          listeners.forEach((listener) => listener.onHydro?.(row));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'environment_data',
          ...(envFilter ? { filter: envFilter } : {}),
        },
        (payload) => {
          const row = payload.new as EnvironmentMeasurement;
          if (!row) return;
          listeners.forEach((listener) => listener.onEnvironment?.(row));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] hydro/environment SUBSCRIBED', deviceId ?? 'all');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] sensors CHANNEL_ERROR — activar replication');
        }
      })
  );
}
