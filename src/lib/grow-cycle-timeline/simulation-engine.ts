import type {
  GrowCyclePlan,
  GrowPhase,
  GrowWeekProfile,
  SimulatedLogEntry,
  TankEvent,
} from './types';

export type WeekHoverMetrics = {
  weekIndex: number;
  phase: GrowPhase;
  ecSetpoint: number;
  phSetpoint: number;
  ecActual: number;
  phActual: number;
  ecError: number;
  phError: number;
  autoStatus: 'on' | 'paused_p1' | 'off';
  lastDosageEcMl: number | null;
  lastDosagePhMl: number | null;
  source: 'simulated' | 'live';
};

const SIM_EC_ERROR_OFFSET = [35, 55, 40, 65, 50, 70, 45, 60, 38, 52, 48, 58, 30];
const SIM_PH_ERROR_OFFSET = [0.04, 0.06, 0.05, 0.08, 0.03, 0.07, 0.05, 0.06, 0.04, 0.05, 0.03, 0.06, 0.02];
const SIM_EC_DOSAGE_THRESHOLD = 50;
const SIM_PH_DOSAGE_THRESHOLD = 0.1;

function resolveAutoStatus(
  plan: GrowCyclePlan,
  weekIndex: number
): WeekHoverMetrics['autoStatus'] {
  if (!plan.autoEcPhEnabled) return 'off';
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  if (tankEvents.length > 0) return 'paused_p1';
  return 'on';
}

export function getWeekHoverMetricsSimulated(
  plan: GrowCyclePlan,
  weekIndex: number
): WeekHoverMetrics | null {
  const profile = getWeekProfile(plan, weekIndex);
  if (!profile) return null;

  const autoStatus = resolveAutoStatus(plan, weekIndex);
  const ecOffset = SIM_EC_ERROR_OFFSET[weekIndex % SIM_EC_ERROR_OFFSET.length] ?? 45;
  const phOffset = SIM_PH_ERROR_OFFSET[weekIndex % SIM_PH_ERROR_OFFSET.length] ?? 0.05;

  const ecActual = Math.max(0, profile.ecSetpointUsCm - ecOffset);
  const phActual = Math.max(0, profile.phSetpoint - phOffset);
  const ecError = Math.abs(profile.ecSetpointUsCm - ecActual);
  const phError = Math.abs(profile.phSetpoint - phActual);

  const dosingActive = autoStatus === 'on';

  return {
    weekIndex,
    phase: profile.phase,
    ecSetpoint: profile.ecSetpointUsCm,
    phSetpoint: profile.phSetpoint,
    ecActual,
    phActual,
    ecError,
    phError,
    autoStatus,
    lastDosageEcMl:
      dosingActive && ecError > SIM_EC_DOSAGE_THRESHOLD
        ? Math.round((ecError / 100) * 1.8 * 10) / 10
        : null,
    lastDosagePhMl:
      dosingActive && phError > SIM_PH_DOSAGE_THRESHOLD
        ? Math.round(phError * 12 * 10) / 10
        : null,
    source: 'simulated',
  };
}

export function getWeekProfile(
  plan: GrowCyclePlan,
  weekIndex: number
): GrowWeekProfile | undefined {
  return plan.weeks.find((w) => w.weekIndex === weekIndex);
}

export function getTankEventsForWeek(
  plan: GrowCyclePlan,
  weekIndex: number
): TankEvent[] {
  return plan.tankEvents.filter((e) => e.weekIndex === weekIndex);
}

export function getSchedulesForWeek(plan: GrowCyclePlan, weekIndex: number) {
  return plan.schedules.filter((s) => s.weekIndex === weekIndex);
}

export function formatSimLogMessage(event: TankEvent): string {
  const kindLabel =
    event.kind === 'initial_fill'
      ? 'INITIAL_FILL'
      : event.kind === 'drain_full'
        ? 'DRAIN_FULL'
        : event.ruleIdSuggested;
  return `[SIM P1] ${kindLabel} trigger ${event.triggerTime} priority ${event.priority}`;
}

export function buildWeekSimulationEntries(
  plan: GrowCyclePlan,
  weekIndex: number,
  seqStart: number
): SimulatedLogEntry[] {
  const entries: SimulatedLogEntry[] = [];
  let seq = seqStart;
  const profile = getWeekProfile(plan, weekIndex);
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  const schedules = getSchedulesForWeek(plan, weekIndex);
  const ts = () => new Date(Date.now() + seq * 1200).toISOString();

  if (profile) {
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P2',
      message: `[SIM P2] EC setpoint ${profile.ecSetpointUsCm} µS/cm (semana S${weekIndex})`,
    });
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P3',
      message: `[SIM P3] pH setpoint ${profile.phSetpoint.toFixed(1)} (semana S${weekIndex})`,
    });
  }

  if (plan.autoEcPhEnabled && profile) {
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P2',
      message: `[SIM] Auto EC/pH ON — bucle continuo entre eventos P1`,
    });
  }

  for (const event of tankEvents) {
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P1',
      message: formatSimLogMessage(event),
    });
    if (event.kind === 'changeout' || event.kind === 'initial_fill') {
      entries.push({
        id: `sim-${seq++}`,
        weekIndex,
        timestamp: ts(),
        layer: 'P2',
        message: `[SIM INTERLOCK] Auto EC/pH pausados (P1 priority >= 80)`,
      });
      entries.push({
        id: `sim-${seq++}`,
        weekIndex,
        timestamp: ts(),
        layer: 'P1',
        message: `[SIM P1] Script hidráulico concluído — hold liberado`,
      });
    }
  }

  for (const sched of schedules) {
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P4',
      message: `[SIM P4] ${sched.ruleId} ${sched.label} (${sched.cadence})`,
    });
  }

  if (weekIndex > 0 && tankEvents.length === 0) {
    entries.push({
      id: `sim-${seq++}`,
      weekIndex,
      timestamp: ts(),
      layer: 'P1',
      message: `[SIM AVISO] Semana S${weekIndex} sem changeout configurado`,
    });
  }

  return entries;
}

export function ecBarHeight(ec: number, maxEc = 2000): number {
  return Math.min(100, Math.max(8, (ec / maxEc) * 100));
}

export function phBarHeight(ph: number, minPh = 5.0, maxPh = 6.5): number {
  return Math.min(100, Math.max(8, ((ph - minPh) / (maxPh - minPh)) * 100));
}

export const SIMULATION_RULES = [
  {
    layer: 'P1',
    title: 'Tanque (prioridade 85–95)',
    body: 'Initial Fill, Changeout e Drain Full pausam dosagem química (interlock simulado).',
  },
  {
    layer: 'P2',
    title: 'Auto EC',
    body: 'Bucle continuo; setpoint lido da barra EC da semana. Não dosifica durante fill.',
  },
  {
    layer: 'P3',
    title: 'Auto pH',
    body: 'Paralelo a P2; setpoint da barra pH. Mutex G5 em produção.',
  },
  {
    layer: 'P4',
    title: 'TIME / SCHEDULE',
    body: 'Circulação e UC Roots independentes do tempo_recirculacao post-dose.',
  },
] as const;
