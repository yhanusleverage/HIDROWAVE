/**
 * Guard determinístico por relé slave: debounce + 1 comando in-flight + cola last-write-wins.
 * Evita tormenta MQTT/ESP-NOW cuando el usuario hace toggle rápido.
 */

export const RELAY_COMMAND_DEBOUNCE_MS = 400;
/** Si no llega ACK, liberar slot para no bloquear la UI indefinidamente */
export const RELAY_COMMAND_IN_FLIGHT_MS = 12000;

export type RelayCommandIntent = {
  action: 'on' | 'off';
  durationSeconds: number;
};

export type RelayCommandExecuteResult = {
  ok: boolean;
  commandId?: string | number;
};

type SlotState = {
  inFlight: boolean;
  inFlightSince: number;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  pendingIntent: RelayCommandIntent | null;
  executeFn: ((intent: RelayCommandIntent) => Promise<RelayCommandExecuteResult>) | null;
};

const slots = new Map<string, SlotState>();

export function relayCommandKey(slaveMac: string, relayId: number): string {
  return `${slaveMac}-${relayId}`;
}

function getSlot(key: string): SlotState {
  let slot = slots.get(key);
  if (!slot) {
    slot = {
      inFlight: false,
      inFlightSince: 0,
      debounceTimer: null,
      pendingIntent: null,
      executeFn: null,
    };
    slots.set(key, slot);
  }
  return slot;
}

function clearDebounce(slot: SlotState) {
  if (slot.debounceTimer) {
    clearTimeout(slot.debounceTimer);
    slot.debounceTimer = null;
  }
}

async function runExecute(key: string, intent: RelayCommandIntent) {
  const slot = getSlot(key);
  if (!slot.executeFn || slot.inFlight) {
    return;
  }

  slot.inFlight = true;
  slot.inFlightSince = Date.now();
  slot.pendingIntent = null;

  try {
    const result = await slot.executeFn(intent);
    if (!result.ok) {
      releaseRelayCommandSlot(key);
    }
    // ok: mantener inFlight hasta ACK (releaseRelayCommandSlot)
  } catch {
    releaseRelayCommandSlot(key);
  }
}

function scheduleFlush(key: string) {
  const slot = getSlot(key);
  clearDebounce(slot);
  slot.debounceTimer = setTimeout(() => {
    slot.debounceTimer = null;
    const intent = slot.pendingIntent;
    if (!intent) return;
    slot.pendingIntent = null;
    if (slot.inFlight) {
      slot.pendingIntent = intent;
      return;
    }
    void runExecute(key, intent);
  }, RELAY_COMMAND_DEBOUNCE_MS);
}

/**
 * Registra intención de comando. UI optimista debe aplicarse antes de llamar.
 * @returns scheduled = enviará tras debounce; queued = espera fin del in-flight
 */
export function scheduleRelayCommand(
  key: string,
  intent: RelayCommandIntent,
  execute: (intent: RelayCommandIntent) => Promise<RelayCommandExecuteResult>
): 'scheduled' | 'queued' {
  const slot = getSlot(key);
  slot.executeFn = execute;
  slot.pendingIntent = intent;

  if (slot.inFlight) {
    return 'queued';
  }

  scheduleFlush(key);
  return 'scheduled';
}

/** Llamar al recibir ACK completed/failed o timeout de seguridad */
export function releaseRelayCommandSlot(key: string) {
  const slot = slots.get(key);
  if (!slot) return;

  slot.inFlight = false;
  slot.inFlightSince = 0;

  if (slot.pendingIntent && slot.executeFn) {
    scheduleFlush(key);
  }
}

export function isRelayCommandInFlight(key: string): boolean {
  const slot = slots.get(key);
  if (!slot?.inFlight) return false;

  if (Date.now() - slot.inFlightSince > RELAY_COMMAND_IN_FLIGHT_MS) {
    releaseRelayCommandSlot(key);
    return false;
  }
  return true;
}

export function cancelRelayCommandSlot(key: string) {
  const slot = slots.get(key);
  if (!slot) return;
  clearDebounce(slot);
  slot.pendingIntent = null;
  slot.inFlight = false;
  slot.inFlightSince = 0;
}
