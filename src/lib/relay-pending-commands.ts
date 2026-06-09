export type PendingRelayCommand = {
  relayKey: string;
  previousState: boolean;
};

/**
 * Procesa ACK terminal (completed/failed) de relay_commands vía WSS o REST fallback.
 */
export function applyRelayCommandAck(
  pendingMap: Map<string | number, PendingRelayCommand>,
  commandId: string | number,
  status: string,
  handlers: {
    onCompleted: (relayKey: string, action?: string) => void;
    onFailed: (relayKey: string, previousState: boolean, relayNumber?: number) => void;
  },
  action?: string,
  relayNumber?: number
): boolean {
  const pending = pendingMap.get(commandId);
  if (!pending) return false;

  const normalized = status.toLowerCase();
  if (normalized === 'completed') {
    handlers.onCompleted(pending.relayKey, action);
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
