import { supabase } from '@/lib/supabase';
import { addSharedChannelListener } from '@/lib/realtime/channel';

export type RelayCommandRow = {
  id: number | string;
  device_id: string;
  status?: string | null;
  action?: 'on' | 'off' | string | null;
  relay_number?: number | null;
  target_device_id?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  duration_seconds?: number | null;
};

const TERMINAL_STATUSES = new Set(['completed', 'failed']);

/** Status não terminais — alinhado a db-schema prod + RPC processing. */
export const PENDING_COMMAND_STATUS_LIST = ['pending', 'sent', 'processing'] as const;
export const PENDING_COMMAND_STATUSES = new Set<string>(PENDING_COMMAND_STATUS_LIST);

/** Margem após duration_seconds antes de tratar comando órfão como não-bloqueante na UI. */
export const SENT_ORPHAN_BUFFER_MS = 30_000;

/** Fallback quando não há duration_seconds (ON/OFF sem timer). */
export const PENDING_STALE_MS = 2 * 60_000;

export type RelayCommandPendingSlice = {
  status?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  duration_seconds?: number | null;
};

function commandAgeMs(cmd: RelayCommandPendingSlice): number | null {
  const anchor = cmd.sent_at || cmd.created_at;
  if (!anchor) return null;
  const ageMs = Date.now() - new Date(anchor).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return null;
  return ageMs;
}

function expectedWindowMs(cmd: RelayCommandPendingSlice): number {
  const durationSec = Number(cmd.duration_seconds);
  return (Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 15) * 1000;
}

/**
 * Comando sem ACK `completed` bloqueia a UI até:
 * - timed (`duration_seconds` > 0): duration + buffer (pending/sent/processing)
 * - sem duração: PENDING_STALE_MS (2 min)
 * Assim dosagem manual órfã (ESP OK, BD stuck) não trava Dosificar por muito tempo.
 */
export function isRelayCommandOperationallyPending(cmd: RelayCommandPendingSlice): boolean {
  const status = (cmd.status || '').toLowerCase();
  if (!PENDING_COMMAND_STATUSES.has(status)) return false;

  const ageMs = commandAgeMs(cmd);
  if (ageMs == null) return true;

  const durationSec = Number(cmd.duration_seconds);
  const hasTimedWindow = Number.isFinite(durationSec) && durationSec > 0;

  if (status === 'sent' || hasTimedWindow) {
    return ageMs < expectedWindowMs(cmd) + SENT_ORPHAN_BUFFER_MS;
  }

  // pending/processing sem timer (ON contínuo / sem duration)
  return ageMs < PENDING_STALE_MS;
}

/**
 * WSS relay_commands — cualquier INSERT/UPDATE (allocation de relés en caliente).
 */
export function subscribeRelayCommandRegistryUpdates(
  masterDeviceId: string,
  onUpdate: (row: RelayCommandRow) => void
): () => void {
  if (!masterDeviceId) return () => {};

  const channelName = `hidrowave-relay-cmds-reg-${masterDeviceId}`;

  const dispatchRow = (listeners: Set<(row: RelayCommandRow) => void>, row: RelayCommandRow) => {
    if (!row?.id || row.device_id !== masterDeviceId) return;
    listeners.forEach((listener) => listener(row));
  };

  return addSharedChannelListener(channelName, onUpdate, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'relay_commands',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => dispatchRow(listeners, payload.new as RelayCommandRow)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'relay_commands',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => dispatchRow(listeners, payload.new as RelayCommandRow)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] relay_commands registry SUBSCRIBED —', masterDeviceId);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(
            '[Realtime] relay_commands registry CHANNEL_ERROR — ejecutar ENABLE_REALTIME_REPLICATION.sql'
          );
        }
      })
  );
}

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

  const dispatchRow = (listeners: Set<(row: RelayCommandRow) => void>, row: RelayCommandRow) => {
    if (!row?.id || row.device_id !== masterDeviceId) return;
    const status = (row.status || '').toLowerCase();
    if (!TERMINAL_STATUSES.has(status)) return;
    listeners.forEach((listener) => listener(row));
  };

  return addSharedChannelListener(channelName, onTerminalUpdate, (listeners) =>
    supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'relay_commands',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => dispatchRow(listeners, payload.new as RelayCommandRow)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'relay_commands',
          filter: `device_id=eq.${masterDeviceId}`,
        },
        (payload) => dispatchRow(listeners, payload.new as RelayCommandRow)
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
      })
  );
}
