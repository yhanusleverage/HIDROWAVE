'use client';

import { useCallback, useMemo, useState } from 'react';
import NavLink from '@/components/NavLink';
import { ArrowLeftIcon, ForwardIcon } from '@heroicons/react/24/outline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwSelect } from '@/components/ui/HwInput';
import { GrowCycleTimelineChart } from '@/components/grow-cycle/GrowCycleTimelineChart';
import { WeekDetailPanel } from '@/components/grow-cycle/WeekDetailPanel';
import { SimulationRulesPanel } from '@/components/grow-cycle/SimulationRulesPanel';
import { MOCK_RDWC_12W_PLAN } from '@/lib/grow-cycle-timeline/mock-rdwc-12w';
import { buildWeekSimulationEntries } from '@/lib/grow-cycle-timeline/simulation-engine';
import type { GrowCyclePlan, SimulatedLogEntry } from '@/lib/grow-cycle-timeline/types';
import { PHASE_LABELS } from '@/lib/grow-cycle-timeline/types';
import { HW_BANNER } from '@/lib/design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useDevicesWithRealtime } from '@/hooks/useDevicesWithRealtime';

export default function TimelineCultivoClient() {
  const { userProfile } = useAuth();
  const { devices } = useDevicesWithRealtime(userProfile?.email);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(MOCK_RDWC_12W_PLAN.totalWeeks);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [playheadWeek, setPlayheadWeek] = useState(0);
  const [simLog, setSimLog] = useState<SimulatedLogEntry[]>([]);
  const [logSeq, setLogSeq] = useState(0);

  const plan: GrowCyclePlan = useMemo(
    () => ({ ...MOCK_RDWC_12W_PLAN, totalWeeks }),
    [totalWeeks]
  );

  const playheadProfile = plan.weeks.find((w) => w.weekIndex === playheadWeek);

  const liveMetricsDeviceId = selectedDeviceId || null;

  const advanceSimulation = useCallback(() => {
    const nextWeek = Math.min(playheadWeek + 1, totalWeeks);
    const entries = buildWeekSimulationEntries(plan, playheadWeek, logSeq);
    setSimLog((prev) => [...prev, ...entries]);
    setLogSeq((s) => s + entries.length);
    setPlayheadWeek(nextWeek);
    setSelectedWeek(playheadWeek);
  }, [plan, playheadWeek, totalWeeks, logSeq]);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text">
      <div
        className={`sticky top-0 z-20 border-b px-4 py-2.5 text-center text-sm font-medium ${HW_BANNER.warn}`}
      >
        Preview — nenhum comando enviado ao ESP32 · dados fictícios
        {liveMetricsDeviceId ? (
          <span className="block text-xs font-normal mt-0.5 opacity-90">
            Métricas ao vivo no tooltip · plano ainda simulado
          </span>
        ) : null}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <NavLink
              href="/processos"
              className="inline-flex items-center gap-1.5 text-xs text-dark-textSecondary hover:text-aqua-400 mb-3"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Processos
            </NavLink>
            <SectionHeader
              title="Timeline de cultivo"
              subtitle={`${plan.name} — designer de ciclo (Fase 0 mock)`}
              accent="brand"
              className="mb-0"
            />
          </div>
          <HwBadge accent="wait">SIMULAÇÃO</HwBadge>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-xs text-dark-textSecondary">
                Duração do ciclo (semanas)
              </span>
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
                Semana atual (simulada)
              </span>
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
                <span className="text-xs text-dark-textSecondary">Fase atual:</span>
                <HwBadge accent="wait">{PHASE_LABELS[playheadProfile.phase]}</HwBadge>
                {playheadProfile.label && (
                  <span className="text-xs text-dark-textSecondary">
                    {playheadProfile.label}
                  </span>
                )}
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <HwSelect
                label="Dispositivo (métricas ao vivo no tooltip)"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
              >
                <option value="">Nenhum — só simulado</option>
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.device_id}
                  </option>
                ))}
              </HwSelect>
            </div>
          </div>

          <button
            type="button"
            onClick={advanceSimulation}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white text-sm font-medium transition-colors"
          >
            <ForwardIcon className="w-4 h-4" />
            Avançar simulação 1 semana
          </button>
        </div>

        <div className="space-y-6">
          <GrowCycleTimelineChart
            plan={plan}
            selectedWeek={selectedWeek}
            playheadWeek={playheadWeek}
            onSelectWeek={setSelectedWeek}
            deviceId={liveMetricsDeviceId}
          />
          <div className="grid md:grid-cols-2 xl:grid-cols-[1fr_360px] gap-4">
            <WeekDetailPanel plan={plan} weekIndex={selectedWeek} />
            <SimulationRulesPanel log={simLog} />
          </div>
        </div>

        <p className="text-xs text-dark-textSecondary text-center pb-4">
          Ver{' '}
          <code className="text-aqua-400/90">
            docs/handoffs/processes/GROW_CYCLE_TIMELINE_IMPLEMENTATION.md
          </code>{' '}
          para roadmap F1–F3 (persistência, decision_rules, firmware).
        </p>
      </div>
    </div>
  );
}
