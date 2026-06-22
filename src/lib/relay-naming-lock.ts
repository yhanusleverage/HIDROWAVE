import {
  PENDING_COMMAND_STATUSES,
  isRelayCommandOperationallyPending,
  type RelayCommandPendingSlice,
} from '@/lib/realtime/relay-commands';
import { DOSER_RELAY_MAX, DOSER_RELAY_MIN } from '@/lib/relay-allocation';

export type RelayNamingLockReason =
  | 'manual_pending'
  | 'ec_auto_dosing'
  | 'ec_auto_recirc'
  | 'ec_auto_enabled'
  | 'ph_auto_dosing'
  | 'ph_auto_recirc'
  | 'manual_dosing_ui';

export type PendingCommandSlice = RelayCommandPendingSlice & {
  relay_number?: number | null;
};

const TOOLTIPS: Record<RelayNamingLockReason, string> = {
  manual_pending: 'Comando manual em curso neste relé',
  ec_auto_dosing: 'Aguarde fim da dosagem',
  ec_auto_recirc: 'Aguarde fim da recirculação',
  ec_auto_enabled: 'Desative o Auto EC para dosificar manualmente',
  ph_auto_dosing: 'Aguarde fim da dosagem pH',
  ph_auto_recirc: 'Aguarde fim da recirculação pH',
  manual_dosing_ui: 'Dosificação manual em curso',
};

function isDoserRelay(n: number): boolean {
  return Number.isInteger(n) && n >= DOSER_RELAY_MIN && n <= DOSER_RELAY_MAX;
}

export function getManualPendingRelaySet(
  pendingCommands: PendingCommandSlice[] | null | undefined
): Set<number> {
  const set = new Set<number>();
  if (!Array.isArray(pendingCommands)) return set;
  for (const cmd of pendingCommands) {
    const relay = Number(cmd.relay_number);
    const status = (cmd.status || '').toLowerCase();
    if (!isDoserRelay(relay)) continue;
    if (!PENDING_COMMAND_STATUSES.has(status)) continue;
    if (!isRelayCommandOperationallyPending(cmd)) continue;
    set.add(relay);
  }
  return set;
}

export function isEcCycleActive(ec?: {
  isDosando?: boolean;
  isAguardandoRecirculacao?: boolean;
  isDiluting?: boolean;
}): boolean {
  return Boolean(
    ec?.isDosando || ec?.isAguardandoRecirculacao || ec?.isDiluting
  );
}

export function isPhCycleActive(ph?: {
  isDosando?: boolean;
  isAguardandoRecirculacao?: boolean;
}): boolean {
  return Boolean(ph?.isDosando || ph?.isAguardandoRecirculacao);
}

export type ResolveRelayNamingLockInput = {
  relayNumber: number;
  domain: 'ec' | 'ph';
  ec?: {
    isDosando?: boolean;
    isAguardandoRecirculacao?: boolean;
  };
  ph?: {
    isDosando?: boolean;
    isAguardandoRecirculacao?: boolean;
  };
  manualPendingRelays?: Set<number>;
  ecManualDosingRelay?: boolean;
};

export type RelayNamingLockResult = {
  locked: boolean;
  reason?: RelayNamingLockReason;
  tooltip: string;
};

export function resolveRelayNamingLock(input: ResolveRelayNamingLockInput): RelayNamingLockResult {
  const { relayNumber, domain, ec, ph, manualPendingRelays, ecManualDosingRelay } = input;

  if (manualPendingRelays?.has(relayNumber)) {
    return { locked: true, reason: 'manual_pending', tooltip: TOOLTIPS.manual_pending };
  }

  if (domain === 'ec') {
    if (ec?.isDosando) {
      return { locked: true, reason: 'ec_auto_dosing', tooltip: TOOLTIPS.ec_auto_dosing };
    }
    if (ec?.isAguardandoRecirculacao) {
      return { locked: true, reason: 'ec_auto_recirc', tooltip: TOOLTIPS.ec_auto_recirc };
    }
    if (ecManualDosingRelay) {
      return { locked: true, reason: 'manual_dosing_ui', tooltip: TOOLTIPS.manual_dosing_ui };
    }
  }

  if (domain === 'ph') {
    if (ph?.isDosando) {
      return { locked: true, reason: 'ph_auto_dosing', tooltip: TOOLTIPS.ph_auto_dosing };
    }
    if (ph?.isAguardandoRecirculacao) {
      return { locked: true, reason: 'ph_auto_recirc', tooltip: TOOLTIPS.ph_auto_recirc };
    }
  }

  return { locked: false, tooltip: '' };
}

/** Bloqueia botão Dosificar manual na tabela EC (Auto EC ativo ou relé ocupado). */
export function resolveEcManualDoseButtonLock(input: {
  autoEnabled: boolean;
  relayNumber: number;
  manualPendingRelays?: Set<number>;
  ecManualDosingRelay?: boolean;
}): RelayNamingLockResult {
  if (input.autoEnabled) {
    return { locked: true, reason: 'ec_auto_enabled', tooltip: TOOLTIPS.ec_auto_enabled };
  }
  if (input.manualPendingRelays?.has(input.relayNumber)) {
    return { locked: true, reason: 'manual_pending', tooltip: TOOLTIPS.manual_pending };
  }
  if (input.ecManualDosingRelay) {
    return { locked: true, reason: 'manual_dosing_ui', tooltip: TOOLTIPS.manual_dosing_ui };
  }
  return { locked: false, tooltip: '' };
}

export function composeRelayControlDisabled(
  adminLocked: boolean,
  operationLock: RelayNamingLockResult,
  adminTitle = 'Controles bloqueados'
): { disabled: boolean; title: string } {
  if (operationLock.locked) {
    return { disabled: true, title: operationLock.tooltip };
  }
  if (adminLocked) {
    return { disabled: true, title: adminTitle };
  }
  return { disabled: false, title: '' };
}
