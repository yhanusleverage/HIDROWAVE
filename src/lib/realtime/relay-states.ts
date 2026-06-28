import { supabase } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export type RelayMasterRow = {
  device_id: string;
  doser_relay_states?: boolean[];
  doser_relay_has_timers?: boolean[];
  level_relay_states?: boolean[];
  reserved_relay_states?: boolean[];
  ec_operation_state?: string;
  ec_operation_remaining_sec?: number;
  ec_next_check_in_sec?: number;
  ph_operation_state?: string;
  ph_operation_remaining_sec?: number;
  ph_next_check_in_sec?: number;
  last_update?: string;
};

export type RelaySlaveRow = {
  device_id: string;
  master_device_id: string;
  slave_mac_address?: string;
  relay_states?: boolean[];
  relay_has_timers?: boolean[];
  relay_remaining_times?: number[];
  relay_names?: string[];
  last_update?: string;
  updated_at?: string;
  link_online?: boolean | null;
};

type RelayStateListener = {
  onMasterUpdate: (row: RelayMasterRow) => void;
  onSlaveUpdate: (row: RelaySlaveRow) => void;
};

/**
 * Realtime relay_master + relay_slaves para un Master.
 * Requiere replication en ENABLE_REALTIME_REPLICATION.sql
 */
export function subscribeRelayStateUpdates(
  masterDeviceId: string,
  onMasterUpdate: (row: RelayMasterRow) => void,
  onSlaveUpdate: (row: RelaySlaveRow) => void
): () => void {
  if (!masterDeviceId) return () => {};

  const channelName = `hidrowave-relays-${masterDeviceId}`;
  const listener: RelayStateListener = { onMasterUpdate, onSlaveUpdate };

  return addSharedChannelListener(channelName, listener, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'relay_master',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => {
          const row = payload.new as RelayMasterRow;
          if (row?.device_id) {
            listeners.forEach((l) => l.onMasterUpdate(row));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'relay_master',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => {
          const row = payload.new as RelayMasterRow;
          if (row?.device_id) {
            listeners.forEach((l) => l.onMasterUpdate(row));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'relay_slaves',
          filter: `master_device_id=eq.${masterDeviceId}`,
        },
        (payload) => {
          const row = payload.new as RelaySlaveRow;
          if (row?.device_id) {
            listeners.forEach((l) => l.onSlaveUpdate(row));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'relay_slaves',
          filter: `master_device_id=eq.${masterDeviceId}`,
        },
        (payload) => {
          const row = payload.new as RelaySlaveRow;
          if (row?.device_id) {
            listeners.forEach((l) => l.onSlaveUpdate(row));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] relay_master/slaves SUBSCRIBED —', masterDeviceId);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] relay states CHANNEL_ERROR — activar replication');
        }
      })
  );
}
