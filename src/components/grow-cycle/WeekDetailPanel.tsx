'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { GrowCyclePlan, GrowPhase } from '@/lib/grow-cycle-timeline/types';
import { GROW_PHASES, PHASE_LABELS } from '@/lib/grow-cycle-timeline/types';
import {
  getWeekProfile,
  getTankEventsForWeek,
  getSchedulesForWeek,
} from '@/lib/grow-cycle-timeline/simulation-engine';
import { getWeekTankVolumeL } from '@/lib/grow-cycle-timeline/tank-volume';
import { syncEcTankVolumeFromWeek } from '@/lib/grow-cycle-timeline/sync-ec-volume';
import { applyDurationSecondsToRule } from '@/lib/grow-cycle-timeline/apply-rule-duration';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HwBadge } from '@/components/ui/HwBadge';
import { HW_TEXT } from '@/lib/design-tokens';
import type { GrowCycleWeeklyStatsRow } from '@/lib/grow-cycle-plans/types';
import { ScheduleChip } from '@/components/grow-cycle/ScheduleChip';
import type { ScheduleUiVersion } from '@/components/grow-cycle/schedule-ui';

type LiveScheduleRow = {
  id: string;
  device_id: string;
  rule_id: string;
  enabled: boolean;
  schedule_type: string;
  time_start: string;
  time_end: string | null;
  grow_week_index: number | null;
  created_by: string | null;
};

type DecisionRuleOption = {
  rule_id: string;
  rule_name: string;
};

interface WeekDetailPanelProps {
  plan: GrowCyclePlan;
  weekIndex: number;
  deviceId?: string | null;
  weeklyStat?: GrowCycleWeeklyStatsRow | null;
  scheduleUiVersion?: ScheduleUiVersion;
  /** Notifica o painel pai para refrescar pastilhas na timeline */
  onSchedulesChanged?: () => void;
  /** Editar fase da semana na receita (preset / plan_json) */
  onWeekPhaseChange?: (weekIndex: number, phase: GrowPhase) => void;
}

function formatTime(value: string): string {
  // Postgres time may come as "08:00:00"
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function scheduleVisibleInWeek(s: LiveScheduleRow, weekIndex: number): boolean {
  if (s.schedule_type === 'daily') return true;
  if (s.schedule_type === 'grow_week' && s.grow_week_index === weekIndex) return true;
  return false;
}

export function WeekDetailPanel({
  plan,
  weekIndex,
  deviceId,
  weeklyStat,
  scheduleUiVersion = 'p1',
  onSchedulesChanged,
  onWeekPhaseChange,
}: WeekDetailPanelProps) {
  const profile = getWeekProfile(plan, weekIndex);
  const tankEvents = getTankEventsForWeek(plan, weekIndex);
  const planSchedules = getSchedulesForWeek(plan, weekIndex);
  const tankVolumeL = getWeekTankVolumeL(plan, weekIndex);
  const [syncing, setSyncing] = useState(false);

  const [liveSchedules, setLiveSchedules] = useState<LiveScheduleRow[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rules, setRules] = useState<DecisionRuleOption[]>([]);
  const [formRuleId, setFormRuleId] = useState('');
  const [formTimeStart, setFormTimeStart] = useState('08:00');
  const [formDurationMin, setFormDurationMin] = useState(15);
  const [saving, setSaving] = useState(false);

  const activeDeviceId =
    deviceId?.trim() && deviceId !== 'default_device' ? deviceId.trim() : '';

  const fetchLiveSchedules = useCallback(async () => {
    if (!activeDeviceId) {
      setLiveSchedules([]);
      return;
    }
    setLiveLoading(true);
    try {
      const res = await fetch(
        `/api/automation/schedules?device_id=${encodeURIComponent(activeDeviceId)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao carregar schedules');
      }
      const rows = (json.schedules || []) as LiveScheduleRow[];
      setLiveSchedules(rows.filter((s) => scheduleVisibleInWeek(s, weekIndex)));
    } catch (e) {
      console.error('[WeekDetail] schedules', e);
      setLiveSchedules([]);
    } finally {
      setLiveLoading(false);
    }
  }, [activeDeviceId, weekIndex]);

  const fetchRules = useCallback(async () => {
    if (!activeDeviceId) {
      setRules([]);
      return;
    }
    try {
      const { getDecisionRules } = await import('@/lib/automation');
      const data = await getDecisionRules(activeDeviceId);
      setRules(
        (data || []).map((r: { rule_id: string; rule_name: string }) => ({
          rule_id: r.rule_id,
          rule_name: r.rule_name,
        }))
      );
    } catch (e) {
      console.error('[WeekDetail] rules', e);
      setRules([]);
    }
  }, [activeDeviceId]);

  useEffect(() => {
    void fetchLiveSchedules();
  }, [fetchLiveSchedules]);

  useEffect(() => {
    if (showForm) void fetchRules();
  }, [showForm, fetchRules]);

  const handleOpenForm = () => {
    if (!activeDeviceId) {
      toast.error('Selecione um HydroWave Core no cabeçalho');
      return;
    }
    setShowForm((v) => !v);
  };

  const handleCreate = async () => {
    if (!activeDeviceId) {
      toast.error('Selecione um HydroWave Core no cabeçalho');
      return;
    }
    if (!formRuleId) {
      toast.error('Selecione uma regra');
      return;
    }
    if (!formTimeStart) {
      toast.error('Informe o horário de início');
      return;
    }
    if (!Number.isFinite(formDurationMin) || formDurationMin <= 0) {
      toast.error('Informe a duração (minutos)');
      return;
    }

    setSaving(true);
    try {
      const durationSeconds = Math.round(formDurationMin * 60);
      const body: Record<string, unknown> = {
        device_id: activeDeviceId,
        rule_id: formRuleId,
        schedule_type: 'daily',
        time_start: formTimeStart,
        created_by: 'grow-cycle-ui',
      };

      const res = await fetch('/api/automation/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error || 'Erro ao criar schedule'
        );
      }

      const durResult = await applyDurationSecondsToRule(
        activeDeviceId,
        formRuleId,
        durationSeconds
      );
      if (!durResult.ok) {
        toast.error(
          `Schedule criado, mas duração na regra falhou: ${durResult.error ?? 'erro'}`
        );
      }

      await fetchLiveSchedules();
      onSchedulesChanged?.();

      toast.success(
        durResult.ok
          ? `Schedule diário criado (${formDurationMin} min na regra)`
          : 'Schedule diário criado'
      );
      setShowForm(false);
      setFormRuleId('');
      setFormTimeStart('08:00');
      setFormDurationMin(15);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este schedule?')) return;
    try {
      const res = await fetch(`/api/automation/schedules?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error || 'Erro ao remover schedule'
        );
      }
      setLiveSchedules((prev) => prev.filter((s) => s.id !== id));
      onSchedulesChanged?.();
      toast.success('Schedule removido com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover schedule');
    }
  };

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
        {activeDeviceId && (
          <button
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              const result = await syncEcTankVolumeFromWeek(activeDeviceId, tankVolumeL);
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
        <p className="text-xs text-dark-textSecondary mb-1">Fase do ciclo</p>
        {onWeekPhaseChange ? (
          <div className="space-y-1.5">
            <select
              value={profile.phase}
              onChange={(e) => {
                const next = e.target.value as GrowPhase;
                onWeekPhaseChange(weekIndex, next);
                toast.success(`S${weekIndex} → ${PHASE_LABELS[next]}`);
              }}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm"
              aria-label={`Fase da semana S${weekIndex}`}
            >
              {GROW_PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-dark-textSecondary">
              Receta do plano (não é schedule live). Guarde o plano para persistir.
            </p>
          </div>
        ) : (
          <HwBadge accent="wait">{PHASE_LABELS[profile.phase]}</HwBadge>
        )}
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

      {planSchedules.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <SectionHeader
              title="Agendamentos do plano"
              accent={scheduleUiVersion === 'p1' ? 'wait' : 'neutral'}
              className="mb-0"
            />
            <HwBadge accent="neutral">plan</HwBadge>
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

      <div className="space-y-3 border-t border-dark-border/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SectionHeader title="Schedules live" accent="brand" className="mb-0" />
            <HwBadge accent="ok">live</HwBadge>
          </div>
          <button
            type="button"
            onClick={handleOpenForm}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white text-xs font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            Novo schedule
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-dark-border bg-dark-surface/50 p-3 space-y-3">
            <div>
              <label className="block text-xs text-dark-textSecondary mb-1">Regra</label>
              <select
                value={formRuleId}
                onChange={(e) => setFormRuleId(e.target.value)}
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text text-sm"
              >
                <option value="">Selecionar regra…</option>
                {rules.map((r) => (
                  <option key={r.rule_id} value={r.rule_id}>
                    {r.rule_name} ({r.rule_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-textSecondary mb-1">Hora (todo dia)</label>
                <input
                  type="time"
                  value={formTimeStart}
                  onChange={(e) => setFormTimeStart(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-textSecondary mb-1">
                  Duração (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={24 * 60}
                  step={1}
                  value={formDurationMin}
                  onChange={(e) => setFormDurationMin(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text text-sm"
                />
              </div>
            </div>
            <p className="text-[10px] text-dark-textSecondary">
              Tipo: daily — pastilha em todas as semanas; duração grava-se na regra (ações timed)
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-dark-border text-dark-textSecondary hover:text-dark-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="px-3 py-1.5 text-xs rounded-lg bg-aqua-600 hover:bg-aqua-500 text-white disabled:opacity-50"
              >
                {saving ? 'A criar…' : 'Criar schedule'}
              </button>
            </div>
          </div>
        )}

        {!activeDeviceId && (
          <p className="text-xs text-dark-textSecondary">
            Selecione um Core para ver e criar schedules live.
          </p>
        )}

        {activeDeviceId && liveLoading && (
          <p className="text-xs text-dark-textSecondary">A carregar schedules…</p>
        )}

        {activeDeviceId && !liveLoading && liveSchedules.length === 0 && (
          <p className="text-xs text-dark-textSecondary">
            Nenhum schedule live ainda (daily ou S{weekIndex}).
          </p>
        )}

        {liveSchedules.length > 0 && (
          <ul className="space-y-2">
            {liveSchedules.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-surface/40 px-3 py-2 text-sm"
              >
                <HwBadge accent={s.enabled ? 'ok' : 'wait'}>
                  {s.enabled ? 'ON' : 'OFF'}
                </HwBadge>
                <HwBadge accent="neutral">
                  {s.schedule_type === 'daily' ? 'todo dia' : `S${s.grow_week_index}`}
                </HwBadge>
                <span className="font-mono text-xs text-dark-text truncate min-w-0">
                  {s.rule_id}
                </span>
                <span className="text-xs text-dark-textSecondary tabular-nums whitespace-nowrap">
                  {formatTime(s.time_start)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(s.id)}
                  className="ml-auto p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                  title="Eliminar schedule"
                  aria-label="Eliminar schedule"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
