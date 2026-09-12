'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';

interface RuleSchedule {
  id: string;
  device_id: string;
  rule_id: string;
  enabled: boolean;
  schedule_type: 'daily' | 'weekly' | 'grow_week';
  time_start: string;
  time_end: string | null;
  days_of_week: number[] | null;
  grow_week_index: number | null;
  timezone: string;
  last_triggered_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DecisionRuleOption {
  rule_id: string;
  rule_name: string;
}

interface ScheduleEditorProps {
  deviceId: string;
}

export default function ScheduleEditor({ deviceId }: ScheduleEditorProps) {
  const { t } = useLanguage();
  const sch = t.automacao.schedule;
  const ac = t.automacao.common;

  const dayLabels = useMemo(
    () => [sch.days.sun, sch.days.mon, sch.days.tue, sch.days.wed, sch.days.thu, sch.days.fri, sch.days.sat],
    [sch.days]
  );

  const scheduleTypeLabel = useCallback(
    (type: RuleSchedule['schedule_type']) => {
      if (type === 'daily') return sch.typeDaily;
      if (type === 'weekly') return sch.typeWeekly;
      return sch.typeGrowWeek;
    },
    [sch.typeDaily, sch.typeWeekly, sch.typeGrowWeek]
  );

  const [schedules, setSchedules] = useState<RuleSchedule[]>([]);
  const [rules, setRules] = useState<DecisionRuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formRuleId, setFormRuleId] = useState('');
  const [formType, setFormType] = useState<'daily' | 'weekly' | 'grow_week'>('daily');
  const [formTimeStart, setFormTimeStart] = useState('08:00');
  const [formTimeEnd, setFormTimeEnd] = useState('');
  const [formDays, setFormDays] = useState<number[]>([]);
  const [formGrowWeek, setFormGrowWeek] = useState(0);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/automation/schedules?device_id=${deviceId}`);
      const json = await res.json();
      setSchedules(json.schedules || []);
    } catch (e) {
      console.error('Error fetching schedules:', e);
    }
  }, [deviceId]);

  const fetchRules = useCallback(async () => {
    try {
      const { getDecisionRules } = await import('@/lib/automation');
      const { isFnCirculationRuleId } = await import('@/lib/rule-execution-history');
      const data = await getDecisionRules(deviceId);
      setRules(
        (data || [])
          .filter(
            (r: { rule_id: string }) => !isFnCirculationRuleId(r.rule_id)
          )
          .map((r: { rule_id: string; rule_name: string }) => ({
            rule_id: r.rule_id,
            rule_name: r.rule_name,
          }))
      );
    } catch (e) {
      console.error('Error fetching rules:', e);
    }
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSchedules(), fetchRules()]).finally(() => setLoading(false));
  }, [fetchSchedules, fetchRules]);

  const handleCreate = async () => {
    if (!formRuleId) return;
    setSaving(true);
    try {
      const { loadSettings } = await import('@/lib/settings');
      const settings = await loadSettings();
      const body: Record<string, unknown> = {
        device_id: deviceId,
        rule_id: formRuleId,
        schedule_type: formType,
        time_start: formTimeStart,
        timezone: settings.timezone || 'America/Sao_Paulo',
      };
      if (formTimeEnd) body.time_end = formTimeEnd;
      if (formType === 'weekly' && formDays.length > 0) body.days_of_week = formDays;
      if (formType === 'grow_week') body.grow_week_index = formGrowWeek;

      const res = await fetch('/api/automation/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        setFormRuleId('');
        await fetchSchedules();
      } else {
        const err = await res.json();
        alert(err.error || sch.errorCreate);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (sched: RuleSchedule) => {
    await fetch('/api/automation/schedules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sched.id, enabled: !sched.enabled }),
    });
    await fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(sch.confirmDelete)) return;
    await fetch(`/api/automation/schedules?id=${id}`, { method: 'DELETE' });
    await fetchSchedules();
  };

  const toggleDay = (day: number) => {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-dark-surface border border-dark-border h-32 flex items-center justify-center">
        <ArrowPathIcon className="w-6 h-6 text-dark-textSecondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card border border-aqua-500/30 rounded-lg shadow-lg p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-aqua-400" />
            <div>
              <h2 className="text-lg font-semibold text-dark-text">{sch.title}</h2>
              <p className="text-sm text-dark-textSecondary">{sch.subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-2 bg-aqua-600 hover:bg-aqua-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            {sch.newButton}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-4 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-dark-text">{sch.createTitle}</h3>

          {/* Regla */}
          <div>
            <label className="block text-sm text-dark-textSecondary mb-1">{sch.selectRule}</label>
            <select
              value={formRuleId}
              onChange={(e) => setFormRuleId(e.target.value)}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm"
            >
              <option value="">{sch.selectRulePlaceholder}</option>
              {rules.map((r) => (
                <option key={r.rule_id} value={r.rule_id}>
                  {r.rule_name} ({r.rule_id})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm text-dark-textSecondary mb-1">{sch.typeLabel}</label>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'grow_week'] as const).map((typeId) => (
                <button
                  key={typeId}
                  onClick={() => setFormType(typeId)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formType === typeId
                      ? 'bg-aqua-600 text-white'
                      : 'bg-dark-surface border border-dark-border text-dark-textSecondary hover:text-dark-text'
                  }`}
                >
                  {scheduleTypeLabel(typeId)}
                </button>
              ))}
            </div>
          </div>

          {/* Hora */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-dark-textSecondary mb-1">{sch.timeStart}</label>
              <input
                type="time"
                value={formTimeStart}
                onChange={(e) => setFormTimeStart(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-dark-textSecondary mb-1">{sch.timeEnd}</label>
              <input
                type="time"
                value={formTimeEnd}
                onChange={(e) => setFormTimeEnd(e.target.value)}
                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm"
              />
            </div>
          </div>

          {/* Dias de la semana */}
          {formType === 'weekly' && (
            <div>
              <label className="block text-sm text-dark-textSecondary mb-2">{sch.daysOfWeek}</label>
              <div className="flex gap-1">
                {dayLabels.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                      formDays.includes(idx)
                        ? 'bg-aqua-600 text-white'
                        : 'bg-dark-surface border border-dark-border text-dark-textSecondary hover:text-dark-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Semana cultivo */}
          {formType === 'grow_week' && (
            <div>
              <label className="block text-sm text-dark-textSecondary mb-1">{sch.growWeek}</label>
              <input
                type="number"
                min={0}
                max={52}
                value={formGrowWeek}
                onChange={(e) => setFormGrowWeek(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text text-sm"
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={saving || !formRuleId}
              className="px-4 py-2 bg-aqua-600 hover:bg-aqua-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? sch.saving : sch.createAction}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-dark-surface border border-dark-border text-dark-textSecondary hover:text-dark-text rounded-lg text-sm transition-colors"
            >
              {ac.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {schedules.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-lg p-8 text-center">
          <ClockIcon className="w-12 h-12 text-dark-textSecondary/50 mx-auto mb-3" />
          <p className="text-dark-textSecondary">{sch.empty}</p>
          <p className="text-xs text-dark-textSecondary/70 mt-1">{sch.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((sched) => {
            const ruleMeta = rules.find((r) => r.rule_id === sched.rule_id);
            const ruleName = resolveDecisionRuleDisplayName(
              {
                rule_id: sched.rule_id,
                rule_name: ruleMeta?.rule_name ?? null,
              },
              t
            );
            return (
              <div
                key={sched.id}
                className={`bg-dark-card border rounded-lg p-4 flex items-center justify-between gap-4 ${
                  sched.enabled ? 'border-aqua-500/30' : 'border-dark-border opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-dark-text truncate">{ruleName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-dark-surface border border-dark-border text-dark-textSecondary shrink-0">
                      {scheduleTypeLabel(sched.schedule_type)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-textSecondary">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {sched.time_start?.slice(0, 5)}
                      {sched.time_end ? ` – ${sched.time_end.slice(0, 5)}` : ''}
                    </span>
                    {sched.days_of_week && sched.days_of_week.length > 0 && (
                      <span>{sched.days_of_week.map((d) => dayLabels[d]).join(', ')}</span>
                    )}
                    {sched.grow_week_index != null && (
                      <span>{sch.weekLabel.replace('{n}', String(sched.grow_week_index))}</span>
                    )}
                    {sched.last_triggered_at && (
                      <span className="text-aqua-400/70">
                        {sch.lastTriggered.replace(
                          '{when}',
                          new Date(sched.last_triggered_at).toLocaleString()
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 pl-3 ml-1 border-l border-dark-border">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sched.enabled}
                    aria-label={sched.enabled ? sch.toggleDisable : sch.toggleEnable}
                    title={sched.enabled ? sch.toggleDisable : sch.toggleEnable}
                    onClick={() => handleToggle(sched)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-400 ${
                      sched.enabled ? 'bg-aqua-600' : 'bg-dark-border'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        sched.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sched.id)}
                    aria-label={sch.deleteAction}
                    title={sch.deleteAction}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/35 text-red-400 hover:bg-red-500/10 hover:border-red-400/50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
