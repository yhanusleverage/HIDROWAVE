export type PendingRelayCommand = {
  relayKey: string;
  previousState: boolean;
  desiredOn?: boolean;
  durationSeconds?: number;
  successToast?: string;
  cycle?: { onDuration: number; offDuration: number } | 'stop';
};

/** Espera ACK ESP-NOW (command_ack) antes de pintar el switch. */
export const SLAVE_COMMAND_ACK_TIMEOUT_MS = 8000;

export type PendingAckTimerMap = Map<string | number, ReturnType<typeof setTimeout>>;

export function clearPendingAckTimeout(
  timers: PendingAckTimerMap,
  commandId: string | number
): void {
  const existing = timers.get(commandId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(commandId);
  }
}

export function armPendingAckTimeout(
  timers: PendingAckTimerMap,
  commandId: string | number,
  onTimeout: () => void,
  timeoutMs = SLAVE_COMMAND_ACK_TIMEOUT_MS
): void {
  clearPendingAckTimeout(timers, commandId);
  timers.set(
    commandId,
    setTimeout(() => {
      timers.delete(commandId);
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
  const pending = pendingMap.get(commandId);
  if (!pending) return false;

  const normalized = status.toLowerCase();
  if (normalized === 'completed') {
    handlers.onCompleted(pending.relayKey, action, pending);
    pendingMap.delete(commandId);
    return true;
  }
  if (normalized === 'failed') {
    handlers.onFailed(pending.relayKey, pending.previousState, relayNumber);
    pendingMap.delete(commandId);
    return true;
  }
  return false;
}
