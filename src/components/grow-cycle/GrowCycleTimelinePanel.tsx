'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import NavLink from '@/components/NavLink';
import {
  ForwardIcon,
  BookmarkIcon,
  BeakerIcon,
  SparklesIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwSelect } from '@/components/ui/HwInput';
import { GrowCycleTimelineChart } from '@/components/grow-cycle/GrowCycleTimelineChart';
import { GrowCycleScheduleBoard } from '@/components/grow-cycle/GrowCycleScheduleBoard';
import { parseScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';
import { WeekDetailPanel } from '@/components/grow-cycle/WeekDetailPanel';
import { SimulationRulesPanel } from '@/components/grow-cycle/SimulationRulesPanel';
import ScheduleEditor from '@/components/automacao/ScheduleEditor';
import { MOCK_RDWC_12W_PLAN } from '@/lib/grow-cycle-timeline/mock-rdwc-12w';
import {
  buildLiveEmptyDisplayPlan,
  buildRecipePlan,
  buildStartCyclePublishPlan,
} from '@/lib/grow-cycle-timeline/build-display-plan';
import {
  liveSchedulesToPlanBlocks,
  type LiveScheduleRow,
} from '@/lib/grow-cycle-timeline/live-schedule-blocks';
import { buildWeekSimulationEntries } from '@/lib/grow-cycle-timeline/simulation-engine';
import type { GrowCyclePlan, GrowPhase, SimulatedLogEntry } from '@/lib/grow-cycle-timeline/types';
import { HW_BANNER } from '@/lib/design-tokens';
import { useGrowCyclePlans, useGrowCycleWeeklyStats } from '@/hooks/useGrowCyclePlans';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
import { getGrowCycleChrome } from '@/lib/translations/grow-cycle';
import { PhaseFlipButtons } from '@/components/grow-cycle/PhaseFlipButtons';

interface DeviceOption {
  device_id: string;
  device_name?: string | null;
}

export interface GrowCycleTimelinePanelProps {
  /** Master device from parent (embedded) or controlled locally (standalone). */
  deviceId?: string | null;
  /** Nombre del Core (device_status.device_name). No es el id ESP32_HIDRO_…. */
  deviceName?: string | null;
  userEmail?: string | null;
  /** When true: no page chrome, no device picker — uses deviceId prop. */
  embedded?: boolean;
  /** Standalone only: device list for picker when deviceId not fixed. */
  devices?: DeviceOption[];
  onDeviceChange?: (deviceId: string) => void;
}

export function GrowCycleTimelinePanel({
  deviceId: deviceIdProp = null,
  deviceName: deviceNameProp = null,
  userEmail,
  embedded = false,
  devices = [],
  onDeviceChange,
}: GrowCycleTimelinePanelProps) {
  const { locale } = useLanguage();
  const gc = useMemo(() => getGrowCycleChrome(locale), [locale]);
  const phaseLabels = gc.phaseLabels;
  const searchParams = useSearchParams();
  const scheduleUiVersion = parseScheduleUiVersion(searchParams.get('scheduleUi'));

  const [localDeviceId, setLocalDeviceId] = useState('');
  const selectedDeviceId = embedded
    ? (deviceIdProp && deviceIdProp !== 'default_device' ? deviceIdProp : '')
    : (deviceIdProp ?? localDeviceId);
  const selectedDeviceName =
    (deviceNameProp && deviceNameProp.trim()) ||
    devices.find((d) => d.device_id === selectedDeviceId)?.device_name?.trim() ||
    '';

  const [totalWeeks, setTotalWeeks] = useState(MOCK_RDWC_12W_PLAN.totalWeeks);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [playheadWeek, setPlayheadWeek] = useState(0);
  const [simLog, setSimLog] = useState<SimulatedLogEntry[]>([]);
  const [logSeq, setLogSeq] = useState(0);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  /** Demo solo si el usuario lo enciende. El Core es el del selector de Automação. */
  const [preview, setPreview] = useState(false);
  /** Agenda de rectángulos. El gráfico es solo EC/pH + resumen. */
  const [surface, setSurface] = useState<'board' | 'chart'>('board');
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveScheduleRows, setLiveScheduleRows] = useState<LiveScheduleRow[]>([]);
  const [scheduleReload, setScheduleReload] = useState(0);
  /** Overrides de fase por semana (receita editável) */
  const [phaseByWeek, setPhaseByWeek] = useState<Partial<Record<number, GrowPhase>>>({});

  const {
    activeInstance,
    tableAvailable,
    savePlan,
    publishPlan,
  } = useGrowCyclePlans(selectedDeviceId || null);

  const { stats: weeklyStats } = useGrowCycleWeeklyStats(
    selectedDeviceId || null,
    activeInstance?.id ?? null
  );

  const recipePlan: GrowCyclePlan = useMemo(() => {
    const base = buildRecipePlan(totalWeeks);
    if (Object.keys(phaseByWeek).length === 0) return base;
    return {
      ...base,
      weeks: base.weeks.map((w) => {
        const phase = phaseByWeek[w.weekIndex];
        if (!phase) return w;
        return { ...w, phase, label: phaseLabels[phase] };
      }),
    };
  }, [totalWeeks, phaseByWeek, phaseLabels]);

  const handleWeekPhaseChange = useCallback((weekIndex: number, phase: GrowPhase) => {
    setPhaseByWeek((prev) => ({ ...prev, [weekIndex]: phase }));
  }, []);

  const liveMetricsDeviceId = selectedDeviceId || null;
  const isPreviewOnly = !selectedDeviceId || !tableAvailable;
  /** El Core elegido manda. La receta de ejemplo solo con el botón Demo. */
  const isDemoMode = preview || !selectedDeviceId;

  const takeScheduleRows = useCallback((rows: LiveScheduleRow[]) => {
    setLiveScheduleRows(rows);
  }, []);

  /** Demo = receita completa; Live = tanque da receita + chips dos schedules DB */
  const displayPlan: GrowCyclePlan = useMemo(() => {
    if (isDemoMode) return recipePlan;
    const base = buildLiveEmptyDisplayPlan(recipePlan);
    const liveBlocks = liveSchedulesToPlanBlocks(liveScheduleRows, base.totalWeeks);
    return { ...base, schedules: liveBlocks };
  }, [isDemoMode, recipePlan, liveScheduleRows]);
  const effectivePlayhead = isDemoMode
    ? playheadWeek
    : (activeInstance?.current_week_index ?? playheadWeek);
  const effectiveStartedAt = isDemoMode ? null : (activeInstance?.started_at ?? null);
  const playheadProfile = displayPlan.weeks.find((w) => w.weekIndex === effectivePlayhead);

  const advanceSimulation = useCallback(() => {
    const nextWeek = Math.min(playheadWeek + 1, totalWeeks);
    const entries = buildWeekSimulationEntries(recipePlan, playheadWeek, logSeq);
    setSimLog((prev) => [...prev, ...entries]);
    setLogSeq((s) => s + entries.length);
    setPlayheadWeek(nextWeek);
    setSelectedWeek(playheadWeek);
  }, [recipePlan, playheadWeek, totalWeeks, logSeq]);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedDeviceId) {
      toast.error(embedded ? gc.selectDeviceEmbedded : gc.selectDevice);
      return;
    }
    setBusy('save');
    const result = await savePlan(recipePlan);
    setBusy(null);
    if (result.ok) {
      setSavedPlanId(result.plan.id);
      toast.success(gc.draftSaved);
    } else {
      toast.error(result.error);
    }
  }, [embedded, gc, recipePlan, savePlan, selectedDeviceId]);

  const handlePublish = useCallback(async () => {
    setActionError(null);
    if (!selectedDeviceId) {
      const msg = embedded ? gc.selectCoreEmbedded : gc.selectCore;
      setActionError(msg);
      toast.error(msg);
      return;
    }
    if (busy) return;

    setBusy('publish');
    const toastId = toast.loading(gc.startingCycleToast);
    /** Arranque: P1 da receita OK; schedules do plano vazios → live começa limpo */
    const publishPlanPayload = buildStartCyclePublishPlan(recipePlan);
    try {
      const result = await publishPlan(
        publishPlanPayload,
        savedPlanId ?? undefined,
        userEmail ?? undefined
      );
      if (result.ok) {
        setPreview(false);
        if (result.plan_id) setSavedPlanId(result.plan_id);
        const schedN = typeof result.schedules_upserted === 'number' ? result.schedules_upserted : 0;
        const warnN = result.warnings?.length ?? 0;
        toast.success(
          gc.cycleStarted + (warnN > 0 ? gc.cycleStartedWarnings.replace('{n}', String(warnN)) : ''),
          { id: toastId, duration: 6000 }
        );
        if (warnN > 0 && result.warnings) {
          setActionError(result.warnings.slice(0, 4).join(' · '));
          console.warn('[iniciar ciclo] avisos', result.warnings);
        }
        setScheduleReload((n) => n + 1);
        void schedN;
      } else {
        const detail =
          result.details?.slice(0, 3).join(' · ') ||
          result.error ||
          gc.startCycleError;
        setActionError(detail);
        toast.error(detail, { id: toastId, duration: 8000 });
        console.warn('[iniciar ciclo] falha', result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : gc.networkError;
      setActionError(msg);
      toast.error(msg, { id: toastId, duration: 8000 });
    } finally {
      setBusy(null);
    }
  }, [
    busy,
    embedded,
    gc,
    recipePlan,
    publishPlan,
    savedPlanId,
    selectedDeviceId,
    userEmail,
  ]);

  const handleDeviceSelect = (value: string) => {
    setLocalDeviceId(value);
    onDeviceChange?.(value);
  };

  return (
    <div className={embedded ? 'space-y-6 min-w-0 w-full' : 'min-h-screen bg-dark-bg text-dark-text'}>
      <div
        className={`${embedded ? 'rounded-lg' : 'sticky top-0 z-20'} border px-4 py-3 text-center text-base font-medium ${HW_BANNER.warn}`}
      >
        {isPreviewOnly ? (
          <>{embedded ? gc.bannerPreviewEmbedded : gc.bannerPreview}</>
        ) : isDemoMode ? (
          <>{gc.bannerDemo}</>
        ) : activeInstance ? (
          <>
            {gc.bannerActive
              .replace(
                '{date}',
                new Date(activeInstance.started_at).toLocaleDateString(toBcp47(locale))
              )
              .replace('{week}', String(activeInstance.current_week_index))}
          </>
        ) : (
          <>{gc.bannerF2}</>
        )}
        {liveMetricsDeviceId ? (
          <span className="block text-sm font-normal mt-1 opacity-90">
            {gc.bannerHoverHint.replace('{n}', String(weeklyStats.length))}
            {isDemoMode ? gc.bannerHoverDemoSuffix : gc.bannerHoverLiveSuffix}
          </span>
        ) : null}
      </div>

      <div className={embedded ? 'space-y-6' : 'max-w-7xl mx-auto px-4 py-6 space-y-6'}>
        {!embedded && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <NavLink
                href="/processos"
                className="inline-flex items-center gap-1.5 text-sm text-dark-textSecondary hover:text-aqua-400 mb-3"
              >
                {gc.processosLink}
              </NavLink>
              <SectionHeader
                title={gc.timelineTitle}
                subtitle={gc.timelineSubtitle.replace('{name}', recipePlan.name)}
                accent="brand"
                size="comfortable"
                className="mb-0"
              />
              <NavLink
                href="/automacao?tab=timeline"
                className="inline-flex items-center gap-1.5 text-sm text-aqua-400 hover:text-aqua-300 mt-2"
              >
                {gc.openInAutomacao}
              </NavLink>
            </div>
            <HwBadge accent={activeInstance ? 'brand' : 'wait'} size="sm">
              {activeInstance ? gc.badgeActive : gc.badgeDesigner}
            </HwBadge>
          </div>
        )}

        {embedded && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader
              title={gc.cicloTitle}
              subtitle={(isDemoMode ? gc.subtitleDemo : gc.subtitleLiveEmpty)
                .replace('{name}', recipePlan.name)
                .replace('{weeks}', String(totalWeeks))}
              accent="brand"
              size="comfortable"
              className="mb-0"
            />
            <div className="flex flex-wrap gap-2">
              <NavLink
                href="/automacao?tab=ec"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              >
                <BeakerIcon className="w-4 h-4" />
                {gc.linkAutoEc}
              </NavLink>
              <NavLink
                href="/automacao?tab=ph"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
              >
                <SparklesIcon className="w-4 h-4" />
                {gc.linkAutoPh}
              </NavLink>
              <NavLink
                href="/automacao?tab=rules"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-dark-surface border border-dark-border text-dark-textSecondary hover:text-dark-text"
              >
                {gc.linkRules}
              </NavLink>
            </div>
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-sm text-dark-textSecondary">{gc.durationLabel}</span>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={1}
                  max={14}
                  value={totalWeeks}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTotalWeeks(v);
                    setPlayheadWeek((p) => Math.min(p, v));
                    setSelectedWeek((s) => Math.min(s, v));
                  }}
                  className="flex-1 accent-aqua-500"
                />
                <span className="text-base font-semibold tabular-nums w-8">{totalWeeks}</span>
              </div>
              <p className="text-sm text-dark-textSecondary mt-1">
                {gc.weeksRangeHint.replace('{weeks}', String(totalWeeks))}
              </p>
            </label>

            <label className="block">
              <span className="text-sm text-dark-textSecondary">
                {isDemoMode ? gc.weekSimulated : gc.weekCycle}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={0}
                  max={totalWeeks}
                  value={effectivePlayhead}
                  disabled={!isDemoMode}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPlayheadWeek(v);
                    setSelectedWeek(v);
                  }}
                  className="flex-1 accent-amber-500 disabled:opacity-50"
                />
                <span className="text-base font-semibold tabular-nums text-amber-300 w-8">
                  S{effectivePlayhead}
                </span>
              </div>
            </label>

            {playheadProfile && (
              <div className="sm:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-dark-textSecondary">{gc.phaseCurrent}</span>
                  <HwBadge accent="wait" size="sm">
                    {phaseLabels[playheadProfile.phase]}
                  </HwBadge>
                  {playheadProfile.label && (
                    <span className="text-sm text-dark-textSecondary">{playheadProfile.label}</span>
                  )}
                </div>
                <PhaseFlipButtons
                  size="sm"
                  value={playheadProfile.phase}
                  labels={phaseLabels}
                  ariaLabel={gc.weekDetail.phaseFlipGroupAria}
                  onChange={(next) => {
                    handleWeekPhaseChange(effectivePlayhead, next);
                    toast.success(
                      gc.weekDetail.toastPhaseChanged
                        .replace('{week}', String(effectivePlayhead))
                        .replace('{phase}', phaseLabels[next])
                    );
                  }}
                />
              </div>
            )}

            {!embedded && (
              <div className="sm:col-span-2 lg:col-span-4">
                <HwSelect
                  label={gc.deviceSelectLabel}
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceSelect(e.target.value)}
                >
                  <option value="">{gc.noneDeviceOption}</option>
                  {devices.map((d) => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id}
                    </option>
                  ))}
                </HwSelect>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {isDemoMode && (
              <button
                type="button"
                onClick={advanceSimulation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-base hover:bg-dark-surface/80"
              >
                <ForwardIcon className="w-4 h-4" />
                {gc.advanceSim}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSurface('board')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-base ${
                surface === 'board'
                  ? 'border-aqua-400/50 bg-aqua-500/15 text-aqua-200'
                  : 'bg-dark-surface border-dark-border text-dark-textSecondary hover:text-dark-text'
              }`}
            >
              {gc.boardView}
            </button>
            <button
              type="button"
              onClick={() => setSurface('chart')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-base ${
                surface === 'chart'
                  ? 'border-aqua-400/50 bg-aqua-500/15 text-aqua-200'
                  : 'bg-dark-surface border-dark-border text-dark-textSecondary hover:text-dark-text'
              }`}
            >
              {gc.chartView}
            </button>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-base ${
                preview
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'bg-dark-surface border-dark-border text-dark-textSecondary hover:text-dark-text'
              }`}
            >
              {preview ? gc.demoOn : gc.demoToggle}
            </button>
            {preview && (
              <span className="text-sm rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                {gc.demoBadge}
              </span>
            )}
            <button
              type="button"
              disabled={!selectedDeviceId || busy != null}
              onClick={() => void handleSaveDraft()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-base hover:bg-dark-surface/80 disabled:opacity-50"
            >
              <BookmarkIcon className="w-4 h-4" />
              {busy === 'save' ? gc.saving : gc.saveDraft}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-base font-medium"
            >
              <PlayIcon className="w-4 h-4" />
              {busy === 'publish'
                ? gc.starting
                : !selectedDeviceId
                  ? gc.startSelectCore
                  : activeInstance
                    ? gc.restartCycle
                    : gc.startCycle}
            </button>
            <span className="text-sm text-dark-textSecondary max-w-sm">{gc.startHint}</span>
          </div>
          {actionError && (
            <p className="text-sm text-amber-300/95 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}
          {!selectedDeviceId && (
            <p className="text-sm text-red-400">{gc.selectCoreToStart}</p>
          )}
        </div>

        <div className="space-y-6 min-w-0 w-full max-w-full">
          {surface === 'board' ? (
            <GrowCycleScheduleBoard
              plan={displayPlan}
              demo={isDemoMode}
              deviceName={selectedDeviceName}
              cycleStartedAt={effectiveStartedAt}
              liveRows={liveScheduleRows}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
            />
          ) : (
            <GrowCycleTimelineChart
              plan={displayPlan}
              selectedWeek={selectedWeek}
              playheadWeek={effectivePlayhead}
              onSelectWeek={setSelectedWeek}
              deviceId={liveMetricsDeviceId}
              weeklyStats={weeklyStats}
              scheduleUiVersion={scheduleUiVersion}
              cycleStartedAt={effectiveStartedAt}
              currentWeekIndex={effectivePlayhead}
              preview={isDemoMode}
              graphOnly
            />
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_360px] gap-4">
            <WeekDetailPanel
              plan={displayPlan}
              weekIndex={selectedWeek}
              deviceId={liveMetricsDeviceId}
              weeklyStat={weeklyStats.find((s) => s.week_index === selectedWeek) ?? null}
              scheduleUiVersion={scheduleUiVersion}
              onWeekPhaseChange={handleWeekPhaseChange}
            />
            <SimulationRulesPanel log={simLog} />
          </div>

          <section className="space-y-3 border-t border-dark-border pt-6">
            <SectionHeader
              title={gc.schedulesSectionTitle}
              subtitle={gc.schedulesSectionSub}
              accent="brand"
              size="comfortable"
            />
            {selectedDeviceId ? (
              <ScheduleEditor
                deviceId={selectedDeviceId}
                weekIndex={selectedWeek}
                embedded
                onRows={takeScheduleRows}
                reloadToken={scheduleReload}
              />
            ) : (
              <p className="text-sm text-dark-textSecondary rounded-lg border border-dark-border bg-dark-card px-4 py-3">
                {gc.schedulesSelectCore}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
