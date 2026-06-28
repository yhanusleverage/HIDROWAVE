export type GrowPhase = 'establishment' | 'vegetative' | 'flip' | 'flower' | 'flush';

export type TankEventKind = 'initial_fill' | 'changeout' | 'drain_full';

export type ProcessLayer = 'P1' | 'P2' | 'P3' | 'P4';

export interface GrowWeekProfile {
  weekIndex: number;
  phase: GrowPhase;
  ecSetpointUsCm: number;
  phSetpoint: number;
  label?: string;
}

export interface TankEvent {
  kind: TankEventKind;
  weekIndex: number;
  triggerTime: string;
  ruleIdSuggested: string;
  priority: number;
  layer: 'P1';
  description: string;
}

export interface ScheduleBlock {
  weekIndex: number;
  ruleId: string;
  layer: 'P4';
  label: string;
  cadence: string;
}

export interface GrowCyclePlan {
  id: string;
  name: string;
  description: string;
  totalWeeks: number;
  weeks: GrowWeekProfile[];
  tankEvents: TankEvent[];
  schedules: ScheduleBlock[];
  autoEcPhEnabled: boolean;
}

export interface SimulatedLogEntry {
  id: string;
  weekIndex: number;
  timestamp: string;
  layer: ProcessLayer;
  message: string;
}

export const PHASE_LABELS: Record<GrowPhase, string> = {
  establishment: 'Estabelecimento',
  vegetative: 'Vegetativo',
  flip: 'Flip',
  flower: 'Floração',
  flush: 'Flush',
};

export const PHASE_COLORS: Record<GrowPhase, string> = {
  establishment: 'bg-emerald-500/25 border-emerald-500/40',
  vegetative: 'bg-green-500/20 border-green-500/40',
  flip: 'bg-amber-500/25 border-amber-500/40',
  flower: 'bg-violet-500/20 border-violet-500/40',
  flush: 'bg-cyan-500/20 border-cyan-500/40',
};
