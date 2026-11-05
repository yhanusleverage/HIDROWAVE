'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { GrowCyclePlan, GrowPhase } from '@/lib/grow-cycle-timeline/types';
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
import { PhaseFlipButtons } from '@/components/grow-cycle/PhaseFlipButtons';
import type { ScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGrowCycleChrome } from '@/lib/translations/grow-cycle';

interface WeekDetailPanelProps {
  plan: GrowCyclePlan;
  weekIndex: number;
  deviceId?: string | null;
  weeklyStat?: GrowCycleWeeklyStatsRow | null;
  scheduleUiVersion?: ScheduleUiVersion;
  /** Editar fase da semana na receita (preset / plan_json) */
  onWeekPhaseChange?: (weekIndex: number, phase: GrowPhase) => void;
}

export function WeekDetailPanel({
  plan,
  weekIndex,
  deviceId,
  weeklyStat,
  scheduleUiVersion = 'p1',
  onWeekPhaseChange,
}: WeekDetailPanelProps) {
  const { locale } = useLanguage();
  const chrome = useMemo(() => getGrowCycleChrome(locale), [locale]);
  const wd = chrome.weekDetail;
  const phaseLabels = chrome.phaseLabels;

  const profile = getWeekProfile(plan, weekIndex);
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  const planSchedules = getSchedulesForWeek(plan, weekIndex);
  const tankVolumeL = getWeekTankVolumeL(plan, weekIndex);
  const [syncing, setSyncing] = useState(false);

  const activeDeviceId =
    deviceId?.trim() && deviceId !== 'default_device' ? deviceId.trim() : '';

  if (!profile) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <p className="text-base text-dark-textSecondary">{wd.invalidWeek}</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
      <SectionHeader
        title={wd.weekTitle.replace('{n}', String(weekIndex))}
        subtitle={profile.label ?? phaseLabels[profile.phase]}
        accent="brand"
        size="comfortable"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
          <p className={`text-sm ${HW_TEXT.ec}`}>{wd.ecTarget}</p>
          <p className={`text-2xl font-bold tabular-nums ${HW_TEXT.ec}`}>
            {profile.ecSetpointUsCm}
            <span className="text-base font-normal ml-1">µS/cm</span>
          </p>
        </div>
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
          <p className={`text-sm ${HW_TEXT.ph}`}>{wd.phTarget}</p>
          <p className={`text-2xl font-bold tabular-nums ${HW_TEXT.ph}`}>
            {profile.phSetpoint.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-300/90">{wd.tankVolumePlan}</p>
          <p className="text-xl font-bold tabular-nums text-dark-text">{tankVolumeL} L</p>
          <p className="text-sm text-dark-textSecondary mt-0.5">
            {wd.tankVolumeHint}
          </p>
        </div>
        {activeDeviceId && (
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              const result = await syncEcTankVolumeFromWeek(activeDeviceId, tankVolumeL);
              setSyncing(false);
              if (result.ok) {
                toast.success(
                  wd.toastVolumeSynced.replace('{L}', String(tankVolumeL))
                );
              } else {
                toast.error(result.error);
              }
            }}
            className="px-3 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 whitespace-nowrap"
          >
            {syncing ? wd.sending : wd.applyToDevice}
          </button>
        )}
      </div>

      <div>
        <p className="text-sm text-dark-textSecondary mb-1">{wd.phaseLabel}</p>
        {onWeekPhaseChange ? (
          <div className="space-y-1.5">
            <PhaseFlipButtons
              value={profile.phase}
              labels={phaseLabels}
              ariaLabel={wd.phaseFlipGroupAria}
              onChange={(next) => {
                onWeekPhaseChange(weekIndex, next);
                toast.success(
                  wd.toastPhaseChanged
                    .replace('{week}', String(weekIndex))
                    .replace('{phase}', phaseLabels[next])
                );
              }}
            />
            <p className="text-sm text-dark-textSecondary">{wd.phaseRecipeHint}</p>
          </div>
        ) : (
          <HwBadge accent="wait" size="sm">{phaseLabels[profile.phase]}</HwBadge>
        )}
      </div>

      {plan.autoEcPhEnabled && (
        <div className="flex gap-2 flex-wrap">
          <HwBadge accent="ec" size="sm">{wd.autoEcOn}</HwBadge>
          <HwBadge accent="ph" size="sm">{wd.autoPhOn}</HwBadge>
        </div>
      )}

      {weeklyStat && (weeklyStat.ec_avg != null || weeklyStat.ph_avg != null) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-200/90">{wd.measuredHistory}</p>
          <div className="grid grid-cols-2 gap-2 text-sm tabular-nums">
            {weeklyStat.ec_avg != null && (
              <div>
                <span className="text-dark-textSecondary">{wd.ecAvg} </span>
                <span className="text-amber-300 font-medium">
                  {Math.round(Number(weeklyStat.ec_avg))} µS/cm
                </span>
              </div>
            )}
            {weeklyStat.ph_avg != null && (
              <div>
                <span className="text-dark-textSecondary">{wd.phAvg} </span>
                <span className="text-amber-300 font-medium">
                  {Number(weeklyStat.ph_avg).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-dark-textSecondary">
            {wd.measuredHint.replace(
              '{date}',
              new Date(weeklyStat.computed_at).toLocaleString()
            )}
          </p>
        </div>
      )}

      {tankEvents.length > 0 && (
        <div>
          <SectionHeader title={wd.eventsP1} accent="warn" size="comfortable" />
          <ul className="space-y-2 mt-2">
            {tankEvents.map((ev) => (
              <li
                key={ev.ruleIdSuggested}
                className="text-sm border border-dark-border rounded-lg p-2 bg-dark-surface/50"
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

      {planSchedules.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <SectionHeader
              title={wd.planSchedules}
              accent={scheduleUiVersion === 'p1' ? 'wait' : 'neutral'}
              size="comfortable"
              className="mb-0"
            />
            <HwBadge accent="neutral" size="sm">plan</HwBadge>
          </div>
          {scheduleUiVersion === 'p1' ? (
            <ul className="space-y-2 mt-2">
              {planSchedules.map((s) => (
                <li key={s.ruleId + s.weekIndex}>
                  <ScheduleChip schedule={s} variant="detail" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1 mt-2">
              {planSchedules.map((s) => (
                <li key={s.ruleId + s.weekIndex} className="text-sm text-dark-textSecondary">
                  <span className="font-mono text-dark-text">{s.ruleId}</span>
                  {' — '}
                  {s.label} ({s.cadence})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-sm text-dark-textSecondary border-t border-dark-border/60 pt-3">
        {wd.calendarBelow}
      </p>
    </div>
  );
}
