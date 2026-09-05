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
import { parseScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';
import { WeekDetailPanel } from '@/components/grow-cycle/WeekDetailPanel';
import { SimulationRulesPanel } from '@/components/grow-cycle/SimulationRulesPanel';
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
import { PHASE_LABELS } from '@/lib/grow-cycle-timeline/types';
import { HW_BANNER } from '@/lib/design-tokens';
import { useGrowCyclePlans, useGrowCycleWeeklyStats } from '@/hooks/useGrowCyclePlans';

interface DeviceOption {
  device_id: string;
}

export interface GrowCycleTimelinePanelProps {
  /** Master device from parent (embedded) or controlled locally (standalone). */
  deviceId?: string | null;
  userEmail?: string | null;
  /** When true: no page chrome, no device picker — uses deviceId prop. */
  embedded?: boolean;
  /** Standalone only: device list for picker when deviceId not fixed. */
  devices?: DeviceOption[];
  onDeviceChange?: (deviceId: string) => void;
}

export function GrowCycleTimelinePanel({
  deviceId: deviceIdProp = null,
  userEmail,
  embedded = false,
  devices = [],
  onDeviceChange,
}: GrowCycleTimelinePanelProps) {
  const searchParams = useSearchParams();
  const scheduleUiVersion = parseScheduleUiVersion(searchParams.get('scheduleUi'));

  const [localDeviceId, setLocalDeviceId] = useState('');
  const selectedDeviceId = embedded
    ? (deviceIdProp && deviceIdProp !== 'default_device' ? deviceIdProp : '')
    : (deviceIdProp ?? localDeviceId);

  const [totalWeeks, setTotalWeeks] = useState(MOCK_RDWC_12W_PLAN.totalWeeks);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [playheadWeek, setPlayheadWeek] = useState(0);
  const [simLog, setSimLog] = useState<SimulatedLogEntry[]>([]);
  const [logSeq, setLogSeq] = useState(0);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  /** Demo local — mesmo padrão Metrics (`preview`): simulação sem dados live */
  const [preview, setPreview] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveScheduleRows, setLiveScheduleRows] = useState<LiveScheduleRow[]>([]);
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
        return { ...w, phase, label: PHASE_LABELS[phase] };
      }),
    };
  }, [totalWeeks, phaseByWeek]);

  const handleWeekPhaseChange = useCallback((weekIndex: number, phase: GrowPhase) => {
    setPhaseByWeek((prev) => ({ ...prev, [weekIndex]: phase }));
  }, []);

  const liveMetricsDeviceId = selectedDeviceId || null;
  const isPreviewOnly = !selectedDeviceId || !tableAvailable;
  /** Sem ciclo activo ou toggle demo → hover/playhead + receta completa */
  const isDemoMode = preview || !activeInstance || !selectedDeviceId;

  const refreshLiveSchedules = useCallback(async () => {
    if (!selectedDeviceId || selectedDeviceId === 'default_device') {
      setLiveScheduleRows([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/automation/schedules?device_id=${encodeURIComponent(selectedDeviceId)}`
      );
      const json = await res.json();
      if (res.ok) {
        setLiveScheduleRows((json.schedules || []) as LiveScheduleRow[]);
      }
    } catch {
      setLiveScheduleRows([]);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    void refreshLiveSchedules();
  }, [refreshLiveSchedules, activeInstance?.id]);

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
      toast.error(embedded ? 'Selecione um dispositivo no cabeçalho' : 'Selecione um dispositivo');
      return;
    }
    setBusy('save');
    const result = await savePlan(recipePlan);
    setBusy(null);
    if (result.ok) {
      setSavedPlanId(result.plan.id);
      toast.success('Plano guardado como rascunho');
    } else {
      toast.error(result.error);
    }
  }, [embedded, recipePlan, savePlan, selectedDeviceId]);

  const handlePublish = useCallback(async () => {
    setActionError(null);
    if (!selectedDeviceId) {
      const msg = embedded
        ? 'Selecione um HydroWave Core no cabeçalho'
        : 'Selecione um HydroWave Core';
      setActionError(msg);
      toast.error(msg);
      return;
    }
    if (busy) return;

    setBusy('publish');
    const toastId = toast.loading('A iniciar ciclo… (pode demorar uns segundos)');
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
          `Ciclo iniciado S0 — FILL/CO/DRAIN ok; Circ vazio até Novo schedule` +
            (warnN > 0 ? ` (${warnN} avisos)` : ''),
          { id: toastId, duration: 6000 }
        );
        if (warnN > 0 && result.warnings) {
          setActionError(result.warnings.slice(0, 4).join(' · '));
          console.warn('[iniciar ciclo] avisos', result.warnings);
        }
        void refreshLiveSchedules();
        void schedN;
      } else {
        const detail =
          result.details?.slice(0, 3).join(' · ') ||
          result.error ||
          'Erro ao iniciar ciclo';
        setActionError(detail);
        toast.error(detail, { id: toastId, duration: 8000 });
        console.warn('[iniciar ciclo] falha', result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro de rede ao iniciar ciclo';
      setActionError(msg);
      toast.error(msg, { id: toastId, duration: 8000 });
    } finally {
      setBusy(null);
    }
  }, [busy, embedded, recipePlan, publishPlan, refreshLiveSchedules, savedPlanId, selectedDeviceId, userEmail]);

  const handleDeviceSelect = (value: string) => {
    setLocalDeviceId(value);
    onDeviceChange?.(value);
  };

  return (
    <div className={embedded ? 'space-y-6 min-w-0 w-full' : 'min-h-screen bg-dark-bg text-dark-text'}>
      <div
        className={`${embedded ? 'rounded-lg' : 'sticky top-0 z-20'} border px-4 py-2.5 text-center text-sm font-medium ${HW_BANNER.warn}`}
      >
        {isPreviewOnly ? (
          <>
            {embedded
              ? 'Preview — selecione o Core no cabeçalho; execute migration SQL para persistência'
              : 'Preview — selecione dispositivo e execute migration SQL para persistência'}
          </>
        ) : isDemoMode ? (
          <>
            Demo local — receita completa (FILL / CO / Circ). Arraste a timeline na horizontal.
          </>
        ) : activeInstance ? (
          <>
            Ciclo activo desde {new Date(activeInstance.started_at).toLocaleDateString()} · S
            {activeInstance.current_week_index}
            {' · '}
            schedules: pastilhas live (todo dia / semana) — Novo schedule no painel
          </>
        ) : (
          <>F2 — Iniciar ciclo: FILL/CO/DRAIN da receita; Circ só quando criar schedule</>
        )}
        {liveMetricsDeviceId ? (
          <span className="block text-xs font-normal mt-0.5 opacity-90">
            Hover = resumo da semana (Δ, ml, ajustes) · {weeklyStats.length} semanas com histórico
            {isDemoMode ? ' · modo demo' : ' · dados live'}
          </span>
        ) : null}
      </div>

      <div className={embedded ? 'space-y-6' : 'max-w-7xl mx-auto px-4 py-6 space-y-6'}>
        {!embedded && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <NavLink
                href="/processos"
                className="inline-flex items-center gap-1.5 text-xs text-dark-textSecondary hover:text-aqua-400 mb-3"
              >
                Processos
              </NavLink>
              <SectionHeader
                title="Timeline de cultivo"
                subtitle={`${recipePlan.name} — ISA-88 Recipe (F1–F2)`}
                accent="brand"
                className="mb-0"
              />
              <NavLink
                href="/automacao?tab=timeline"
                className="inline-flex items-center gap-1.5 text-xs text-aqua-400 hover:text-aqua-300 mt-2"
              >
                Abrir em Automação → Ciclo de Cultivo
              </NavLink>
            </div>
            <HwBadge accent={activeInstance ? 'brand' : 'wait'}>
              {activeInstance ? 'CICLO ACTIVO' : 'DESIGNER'}
            </HwBadge>
          </div>
        )}

        {embedded && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader
              title="Ciclo de Cultivo"
              subtitle={`${recipePlan.name} — receita S0…S${totalWeeks}${
                isDemoMode ? ' · demo' : ' · live vazio'
              }`}
              accent="brand"
              className="mb-0"
            />
            <div className="flex flex-wrap gap-2">
              <NavLink
                href="/automacao?tab=ec"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              >
                <BeakerIcon className="w-3.5 h-3.5" />
                Auto EC
              </NavLink>
              <NavLink
                href="/automacao?tab=ph"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                Auto pH
              </NavLink>
              <NavLink
                href="/automacao?tab=rules"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-dark-surface border border-dark-border text-dark-textSecondary hover:text-dark-text"
              >
                Ver regras publicadas
              </NavLink>
            </div>
          </div>
        )}

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-xs text-dark-textSecondary">Duração do ciclo (semanas)</span>
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
                <span className="text-sm font-semibold tabular-nums w-8">{totalWeeks}</span>
              </div>
              <p className="text-[10px] text-dark-textSecondary mt-1">S0 … S{totalWeeks}</p>
            </label>

            <label className="block">
              <span className="text-xs text-dark-textSecondary">
                {isDemoMode ? 'Semana actual (simulada)' : 'Semana actual (ciclo)'}
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
                <span className="text-sm font-semibold tabular-nums text-amber-300 w-8">
                  S{effectivePlayhead}
                </span>
              </div>
            </label>

            {playheadProfile && (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-dark-textSecondary">Fase actual:</span>
                <HwBadge accent="wait">{PHASE_LABELS[playheadProfile.phase]}</HwBadge>
                {playheadProfile.label && (
                  <span className="text-xs text-dark-textSecondary">{playheadProfile.label}</span>
                )}
              </div>
            )}

            {!embedded && (
              <div className="sm:col-span-2 lg:col-span-4">
                <HwSelect
                  label="HydroWave Core"
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceSelect(e.target.value)}
                >
                  <option value="">Nenhum — só simulado</option>
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-sm hover:bg-dark-surface/80"
              >
                <ForwardIcon className="w-4 h-4" />
                Avançar simulação 1 semana
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
                preview
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'bg-dark-surface border-dark-border text-dark-textSecondary hover:text-dark-text'
              }`}
            >
              {preview ? 'Demo local ON' : 'Alternar demo (dev)'}
            </button>
            {preview && (
              <span className="text-xs rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                Demo local
              </span>
            )}
            <button
              type="button"
              disabled={!selectedDeviceId || busy != null}
              onClick={() => void handleSaveDraft()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-sm hover:bg-dark-surface/80 disabled:opacity-50"
            >
              <BookmarkIcon className="w-4 h-4" />
              {busy === 'save' ? 'Guardando…' : 'Guardar rascunho'}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              <PlayIcon className="w-4 h-4" />
              {busy === 'publish'
                ? 'A iniciar…'
                : !selectedDeviceId
                  ? 'Iniciar ciclo (selecione Core)'
                  : activeInstance
                    ? 'Reiniciar ciclo'
                    : 'Iniciar ciclo'}
            </button>
            <span className="text-[10px] text-dark-textSecondary max-w-xs">
              Iniciar = S0 + FILL/CO/DRAIN; sem Circ automático
            </span>
          </div>
          {actionError && (
            <p className="text-xs text-amber-300/95 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}
          {!selectedDeviceId && (
            <p className="text-xs text-red-400">
              Selecione um HydroWave Core no cabeçalho para iniciar o ciclo.
            </p>
          )}
        </div>

        <div className="space-y-6 min-w-0 w-full max-w-full">
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
          />
          <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_360px] gap-4">
            <WeekDetailPanel
              plan={displayPlan}
              weekIndex={selectedWeek}
              deviceId={liveMetricsDeviceId}
              weeklyStat={weeklyStats.find((s) => s.week_index === selectedWeek) ?? null}
              scheduleUiVersion={scheduleUiVersion}
              onSchedulesChanged={() => void refreshLiveSchedules()}
              onWeekPhaseChange={handleWeekPhaseChange}
            />
            <SimulationRulesPanel log={simLog} />
          </div>
        </div>
      </div>
    </div>
  );
}
