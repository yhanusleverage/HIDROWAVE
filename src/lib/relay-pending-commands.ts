export type PendingRelayCommand = {
  relayKey: string;
  previousState: boolean;
  desiredOn?: boolean;
  durationSeconds?: number;
  successToast?: string;
  cycle?: { onDuration: number; offDuration: number } | 'stop';
};

/** Espera ACK (command_ack o relay_slaves). 8s era corto para ESP-NOW + bridge. */
export const SLAVE_COMMAND_ACK_TIMEOUT_MS = 20_000;

export function commandAckId(commandId: string | number): string {
  return String(commandId);
}

export type PendingAckTimerMap = Map<string | number, ReturnType<typeof setTimeout>>;

export function clearPendingAckTimeout(
  timers: PendingAckTimerMap,
  commandId: string | number
): void {
  const key = commandAckId(commandId);
  const existing = timers.get(key);
  if (existing) {
    clearTimeout(existing);
    timers.delete(key);
  }
}

export function armPendingAckTimeout(
  timers: PendingAckTimerMap,
  commandId: string | number,
  onTimeout: () => void,
  timeoutMs = SLAVE_COMMAND_ACK_TIMEOUT_MS
): void {
  const key = commandAckId(commandId);
  clearPendingAckTimeout(timers, key);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      onTimeout();
    }, timeoutMs)
  );
}

/**
 * Procesa ACK terminal (completed/failed) de relay_commands vía WSS o REST fallback.
 */
export function applyRelayCommandAck(
  pendingMap: Map<string | number, PendingRelayCommand>,
  commandId: string | number,
  status: string,
  handlers: {
    onCompleted: (relayKey: string, action?: string, pending?: PendingRelayCommand) => void;
    onFailed: (relayKey: string, previousState: boolean, relayNumber?: number) => void;
  },
  action?: string,
  relayNumber?: number
): boolean {
  const key = commandAckId(commandId);
  const pending = pendingMap.get(key) ?? pendingMap.get(commandId);
  if (!pending) return false;

  const normalized = status.toLowerCase();
  if (normalized === 'completed') {
    handlers.onCompleted(pending.relayKey, action, pending);
    pendingMap.delete(key);
    pendingMap.delete(commandId);
    return true;
  }
  if (normalized === 'failed') {
    handlers.onFailed(pending.relayKey, pending.previousState, relayNumber);
    pendingMap.delete(key);
    pendingMap.delete(commandId);
    return true;
  }
  return false;
}

/** Si relay_slaves ya tiene el estado pedido, el comando llegó: cierra pendientes sin toast de error. */
export function settlePendingByRelayState(
  pendingMap: Map<string | number, PendingRelayCommand>,
  timers: PendingAckTimerMap,
  states: Map<string, boolean>,
  onSettled: (pending: PendingRelayCommand) => void
): void {
  const ids: Array<string | number> = [];
  pendingMap.forEach((pending, id) => {
    if (pending.desiredOn === undefined) return;
    if (states.get(pending.relayKey) === pending.desiredOn) {
      ids.push(id);
    }
  });
  ids.forEach((id) => {
    const pending = pendingMap.get(id);
    if (!pending) return;
    clearPendingAckTimeout(timers, id);
    pendingMap.delete(id);
    onSettled(pending);
  });
}
