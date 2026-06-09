import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RelayCommandRow = {
  id: number | string;
  device_id: string;
  status?: string | null;
  action?: 'on' | 'off' | string | null;
  relay_number?: number | null;
  target_device_id?: string | null;
};

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

/**
 * WSS relay_commands — ACK instantáneo cuando status pasa a completed/failed.
 * Requiere relay_commands en supabase_realtime (ENABLE_REALTIME_REPLICATION.sql).
 */
export function subscribeRelayCommandUpdates(
  masterDeviceId: string,
  onTerminalUpdate: (row: RelayCommandRow) => void
): () => void {
  if (!masterDeviceId) return () => {};

  const channelName = `hidrowave-relay-cmds-${masterDeviceId}`;
  let channel: RealtimeChannel | null = null;

  const handleRow = (row: RelayCommandRow) => {
    if (!row?.id || row.device_id !== masterDeviceId) return;
    const status = (row.status || '').toLowerCase();
    if (!TERMINAL_STATUSES.has(status)) return;
    onTerminalUpdate(row);
  };

  channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'relay_commands',
        filter: `device_id=eq.${masterDeviceId}`,
      },
      (payload) => handleRow(payload.new as RelayCommandRow)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'relay_commands',
        filter: `device_id=eq.${masterDeviceId}`,
      },
      (payload) => handleRow(payload.new as RelayCommandRow)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] relay_commands SUBSCRIBED —', masterDeviceId);
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn(
          '[Realtime] relay_commands CHANNEL_ERROR — ejecutar ENABLE_REALTIME_REPLICATION.sql (relay_commands)'
        );
      }
    });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}
