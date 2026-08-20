'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { GrowCyclePlan } from '@/lib/grow-cycle-timeline/types';
import {
  PHASE_LABELS,
} from '@/lib/grow-cycle-timeline/types';
import {
  getWeekProfile,
  getTankEventsForWeek,
  getSchedulesForWeek,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import { getWeekTankVolumeL } from '@/lib/grow-cycle-timeline/tank-volume';
import { syncEcTankVolumeFromWeek } from '@/lib/grow-cycle-timeline/sync-ec-volume';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HW_TEXT } from '@/lib/design-tokens';

import type { GrowCycleWeeklyStatsRow } from '@/lib/grow-cycle-plans/types';

import { ScheduleChip } from '@/components/grow-cycle/ScheduleChip';
import type { ScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';

interface WeekDetailPanelProps {
  plan: GrowCyclePlan;
  weekIndex: number;
  deviceId?: string | null;
  weeklyStat?: GrowCycleWeeklyStatsRow | null;
  scheduleUiVersion?: ScheduleUiVersion;
}

export function WeekDetailPanel({
  plan,
  weekIndex,
  deviceId,
  weeklyStat,
  scheduleUiVersion = 'p1',
}: WeekDetailPanelProps) {
  const profile = getWeekProfile(plan, weekIndex);
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  const schedules = getSchedulesForWeek(plan, weekIndex);
  const tankVolumeL = getWeekTankVolumeL(plan, weekIndex);
  const [syncing, setSyncing] = useState(false);

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

      <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-cyan-300/90">Volume tanque (plan)</p>
          <p className="text-xl font-bold tabular-nums text-dark-text">{tankVolumeL} L</p>
          <p className="text-[10px] text-dark-textSecondary mt-0.5">
            Usado na fórmula de diluição EC (V_tanque)
          </p>
        </div>
        {deviceId?.trim() && deviceId !== 'default_device' && (
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              const result = await syncEcTankVolumeFromWeek(deviceId, tankVolumeL);
              setSyncing(false);
              if (result.ok) {
                toast.success(`Volume ${tankVolumeL} L enviado ao Auto EC`);
              } else {
                toast.error(result.error);
              }
            }}
            className="px-3 py-1.5 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 whitespace-nowrap"
          >
            {syncing ? 'Enviando…' : 'Aplicar ao device'}
          </button>
        )}
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

      {weeklyStat && (weeklyStat.ec_avg != null || weeklyStat.ph_avg != null) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-200/90">Medido (histórico)</p>
          <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
            {weeklyStat.ec_avg != null && (
              <div>
                <span className="text-dark-textSecondary">EC avg </span>
                <span className="text-amber-300 font-medium">
                  {Math.round(Number(weeklyStat.ec_avg))} µS/cm
                </span>
              </div>
            )}
            {weeklyStat.ph_avg != null && (
              <div>
                <span className="text-dark-textSecondary">pH avg </span>
                <span className="text-amber-300 font-medium">
                  {Number(weeklyStat.ph_avg).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-dark-textSecondary">
            Snapshot {new Date(weeklyStat.computed_at).toLocaleString()}
          </p>
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
          <SectionHeader
            title="Agendamentos P4"
            accent={scheduleUiVersion === 'p1' ? 'wait' : 'neutral'}
          />
          {scheduleUiVersion === 'p1' ? (
            <ul className="space-y-2 mt-2">
              {schedules.map((s) => (
                <li key={s.ruleId + s.weekIndex}>
                  <ScheduleChip schedule={s} variant="detail" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1 mt-2">
              {schedules.map((s) => (
                <li key={s.ruleId + s.weekIndex} className="text-xs text-dark-textSecondary">
                  <span className="font-mono text-dark-text">{s.ruleId}</span>
                  {' — '}
                  {s.label} ({s.cadence})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
