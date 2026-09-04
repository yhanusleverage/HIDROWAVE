import { SLAVE_COMMAND_ACK_TIMEOUT_MS } from '@/lib/relay-pending-commands';

export type SlaveRelayMessageContext = {
  slaveName?: string;
  relayLabel?: string;
  /** undefined = desconhecido no momento do toast */
  slaveOnline?: boolean;
  previousState?: boolean;
};

const TIMEOUT_SEC = Math.round(SLAVE_COMMAND_ACK_TIMEOUT_MS / 1000);

/** Nome amigável — evita mostrar placeholder técnico do firmware. */
export function slaveDisplayName(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === 'ESP-NOW-SLAVE') {
    return 'HydroWave Atlas';
  }
  return trimmed;
}

function relayStateWord(on: boolean): string {
  return on ? 'ligado' : 'desligado';
}

/** Timeout aguardando ACK / estado relay_slaves. */
export function formatSlaveAckTimeoutMessage(ctx: SlaveRelayMessageContext): string {
  const atlas = slaveDisplayName(ctx.slaveName);
  const relayPart = ctx.relayLabel ? ` — ${ctx.relayLabel}` : '';
  const reverted =
    ctx.previousState !== undefined
      ? relayStateWord(ctx.previousState)
      : 'anterior';

  if (ctx.slaveOnline === false) {
    return `${atlas} parece offline${relayPart}. O relé voltou ao estado ${reverted}. Verifique alimentação e proximidade ao HydroWave Core.`;
  }

  if (ctx.slaveOnline === true) {
    return `${atlas} está online, mas não confirmou a tempo${relayPart} (${TIMEOUT_SEC} s). O relé voltou ao estado ${reverted}. Se o relé mudou fisicamente, atualize a página; senão, tente de novo.`;
  }

  return `Sem confirmação a tempo${relayPart} (${TIMEOUT_SEC} s). O relé voltou ao estado ${reverted}. Verifique se o Atlas e o Core estão online.`;
}

/** API OK sem command_id — não dá para rastrear ACK. */
export function formatSlaveNoTrackingMessage(ctx: SlaveRelayMessageContext): string {
  const atlas = slaveDisplayName(ctx.slaveName);
  const relayPart = ctx.relayLabel ? ` (${ctx.relayLabel})` : '';
  return `Comando enviado a ${atlas}${relayPart}, mas não foi possível acompanhar a confirmação. Tente novamente.`;
}

/** ACK terminal failed do backend. */
export function formatSlaveCommandFailedMessage(ctx: SlaveRelayMessageContext, relayNum?: number): string {
  if (ctx.relayLabel) {
    return `${ctx.relayLabel} não respondeu ao comando.`;
  }
  if (relayNum !== undefined) {
    return `O relé ${relayNum} não respondeu ao comando.`;
  }
  return 'O relé não respondeu ao comando.';
}
