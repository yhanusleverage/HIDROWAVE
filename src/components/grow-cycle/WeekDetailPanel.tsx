'use client';

import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import {
  PHASE_LABELS,
} from '@/lib/grow-cycle-timeline/types';
import {
  getWeekProfile,
  getTankEventsForWeek,
  getSchedulesForWeek,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HW_TEXT } from '@/lib/design-tokens';

interface WeekDetailPanelProps {
  plan: GrowCyclePlan;
  weekIndex: number;
}

export function WeekDetailPanel({ plan, weekIndex }: WeekDetailPanelProps) {
  const profile = getWeekProfile(plan, weekIndex);
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  const schedules = getSchedulesForWeek(plan, weekIndex);

  if (!profile) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <p className="text-sm text-dark-textSecondary">Semana inválida.</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
      <SectionHeader
        title={`Semana S${weekIndex}`}
        subtitle={profile.label ?? PHASE_LABELS[profile.phase]}
        accent="brand"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <p className={`text-xs ${HW_TEXT.ec}`}>EC alvo</p>
          <p className={`text-2xl font-bold tabular-nums ${HW_TEXT.ec}`}>
            {profile.ecSetpointUsCm}
            <span className="text-sm font-normal ml-1">µS/cm</span>
          </p>
        </div>
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
          <p className={`text-xs ${HW_TEXT.ph}`}>pH alvo</p>
          <p className={`text-2xl font-bold tabular-nums ${HW_TEXT.ph}`}>
            {profile.phSetpoint.toFixed(1)}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-dark-textSecondary mb-1">Fase</p>
        <HwBadge accent="wait">{PHASE_LABELS[profile.phase]}</HwBadge>
      </div>

      {plan.autoEcPhEnabled && (
        <div className="flex gap-2 flex-wrap">
          <HwBadge accent="ec">Auto EC ON</HwBadge>
          <HwBadge accent="ph">Auto pH ON</HwBadge>
        </div>
      )}

      {tankEvents.length > 0 && (
        <div>
          <SectionHeader title="Eventos P1 (tanque)" accent="warn" />
          <ul className="space-y-2 mt-2">
            {tankEvents.map((ev) => (
              <li
                key={ev.ruleIdSuggested}
                className="text-xs border border-dark-border rounded-lg p-2 bg-dark-surface/50"
              >
                <p className="font-mono text-amber-300/95">{ev.ruleIdSuggested}</p>
                <p className="text-dark-textSecondary mt-0.5">{ev.description}</p>
                <p className="text-dark-textSecondary mt-1">
                  {ev.triggerTime} · priority {ev.priority}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedules.length > 0 && (
        <div>
          <SectionHeader title="Agendamentos P4" accent="neutral" />
          <ul className="space-y-1 mt-2">
            {schedules.map((s) => (
              <li key={s.ruleId + s.weekIndex} className="text-xs text-dark-textSecondary">
                <span className="font-mono text-dark-text">{s.ruleId}</span>
                {' — '}
                {s.label} ({s.cadence})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
