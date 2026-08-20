'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import NavLink from '@/components/NavLink';
import {
  CloudArrowUpIcon,
  ForwardIcon,
  BookmarkIcon,
  BeakerIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwSelect } from '@/components/ui/HwInput';
import { GrowCycleTimelineChart } from '@/components/grow-cycle/GrowCycleTimelineChart';
import { parseScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';
import { WeekDetailPanel } from '@/components/grow-cycle/WeekDetailPanel';
import { SimulationRulesPanel } from '@/components/grow-cycle/SimulationRulesPanel';
import { MOCK_RDWC_12W_PLAN } from '@/lib/grow-cycle-timeline/mock-rdwc-12w';
import { buildWeekSimulationEntries } from '@/lib/grow-cycle-timeline/simulation-engine';
import type { GrowCyclePlan, SimulatedLogEntry } from '@/lib/grow-cycle-timeline/types';
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

  const plan: GrowCyclePlan = useMemo(
    () => ({ ...MOCK_RDWC_12W_PLAN, totalWeeks }),
    [totalWeeks]
  );

  const playheadProfile = plan.weeks.find((w) => w.weekIndex === playheadWeek);
  const liveMetricsDeviceId = selectedDeviceId || null;
  const isPreviewOnly = !selectedDeviceId || !tableAvailable;

  const advanceSimulation = useCallback(() => {
    const nextWeek = Math.min(playheadWeek + 1, totalWeeks);
    const entries = buildWeekSimulationEntries(plan, playheadWeek, logSeq);
    setSimLog((prev) => [...prev, ...entries]);
    setLogSeq((s) => s + entries.length);
    setPlayheadWeek(nextWeek);
    setSelectedWeek(playheadWeek);
  }, [plan, playheadWeek, totalWeeks, logSeq]);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedDeviceId) {
      toast.error(embedded ? 'Selecione um dispositivo no cabeçalho' : 'Selecione um dispositivo');
      return;
    }
    setBusy('save');
    const result = await savePlan(plan);
    setBusy(null);
    if (result.ok) {
      setSavedPlanId(result.plan.id);
      toast.success('Plano guardado como rascunho');
    } else {
      toast.error(result.error);
    }
  }, [embedded, plan, savePlan, selectedDeviceId]);

  const handlePublish = useCallback(async () => {
    if (!selectedDeviceId) {
      toast.error(embedded ? 'Selecione um HydroWave Core no cabeçalho' : 'Selecione um HydroWave Core');
      return;
    }
    setBusy('publish');
    const result = await publishPlan(plan, savedPlanId ?? undefined, userEmail ?? undefined);
    setBusy(null);
    if (result.ok) {
      toast.success(
        `Plano publicado — ${result.rules_created ?? 0} regras criadas, ${result.rules_updated ?? 0} atualizadas`
      );
    } else {
      toast.error(result.error ?? 'Erro ao publicar');
      if (result.details?.length) {
        console.warn('[publish]', result.details);
      }
    }
  }, [embedded, plan, publishPlan, savedPlanId, selectedDeviceId, userEmail]);

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
        ) : activeInstance ? (
          <>
            Ciclo activo desde {new Date(activeInstance.started_at).toLocaleDateString()} · S
            {activeInstance.current_week_index}
          </>
        ) : (
          <>F2 — plano persistível · publicar gera decision_rules P1+P4</>
        )}
        {liveMetricsDeviceId ? (
          <span className="block text-xs font-normal mt-0.5 opacity-90">
            Métricas ao vivo no tooltip · {weeklyStats.length} semanas com histórico
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
                subtitle={`${plan.name} — ISA-88 Recipe (F1–F2)`}
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
              subtitle={`${plan.name} — receita S0…S${totalWeeks}`}
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
              <span className="text-xs text-dark-textSecondary">Semana actual (simulada)</span>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={0}
                  max={totalWeeks}
                  value={playheadWeek}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPlayheadWeek(v);
                    setSelectedWeek(v);
                  }}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-sm font-semibold tabular-nums text-amber-300 w-8">
                  S{playheadWeek}
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={advanceSimulation}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-sm hover:bg-dark-surface/80"
            >
              <ForwardIcon className="w-4 h-4" />
              Avançar simulação 1 semana
            </button>
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
              disabled={!selectedDeviceId || busy != null}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              {busy === 'publish' ? 'Publicando…' : 'Publicar plano (P1+P4)'}
            </button>
          </div>
        </div>

        <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
          <GrowCycleTimelineChart
            plan={plan}
            selectedWeek={selectedWeek}
            playheadWeek={playheadWeek}
            onSelectWeek={setSelectedWeek}
            deviceId={liveMetricsDeviceId}
            weeklyStats={weeklyStats}
            scheduleUiVersion={scheduleUiVersion}
          />
          <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_360px] gap-4">
            <WeekDetailPanel
              plan={plan}
              weekIndex={selectedWeek}
              deviceId={liveMetricsDeviceId}
              weeklyStat={weeklyStats.find((s) => s.week_index === selectedWeek) ?? null}
              scheduleUiVersion={scheduleUiVersion}
            />
            <SimulationRulesPanel log={simLog} />
          </div>
        </div>
      </div>
    </div>
  );
}
