'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
import { HwBadge } from '@/components/ui/HwBadge';
import { supabase } from '@/lib/supabase';
import {
  collapseKeepaliveExecutions,
  displayNameForExecution,
  fetchRuleExecutions,
  prependExecution,
  ruleIdFromCreatedBy,
  type RuleExecutionRow,
} from '@/lib/rule-execution-history';
import {
  displayNameForConfigEvent,
  fetchRuleConfigEvents,
  RULE_CONFIG_HISTORY_EVENT,
  type RuleConfigEvent,
} from '@/lib/rule-config-history';
import {
  displayNameForProcedure,
  fetchProcedureEvents,
  fetchRuleNameLookup,
  prependProcedureEvent,
  procedureRuleIdsFromLookup,
  type ProcedureEventRow,
  type RuleNameLookup,
} from '@/lib/rule-procedure-history';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import type { AppTranslations } from '@/lib/translations/app/types';

const HISTORY_LIMIT = 24;
const RAW_BUFFER = 100;

type TimelineItem =
  | {
      kind: 'execution';
      sortAt: string;
      key: string;
      row: ReturnType<typeof collapseKeepaliveExecutions>[number];
    }
  | {
      kind: 'config';
      sortAt: string;
      key: string;
      event: RuleConfigEvent;
    }
  | {
      kind: 'procedure';
      sortAt: string;
      key: string;
      event: ProcedureEventRow;
    };

interface RuleExecutionHistoryPanelProps {
  deviceId: string;
}

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(toBcp47(locale), {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function humanExecutionName(
  row: RuleExecutionRow,
  names: RuleNameLookup,
  t: AppTranslations
): string {
  const ruleId = ruleIdFromCreatedBy(row.created_by);
  if (ruleId && names[ruleId]) {
    const name = resolveDecisionRuleDisplayName(
      {
        rule_id: ruleId,
        rule_name: names[ruleId].rule_name ?? ruleId,
        rule_json: names[ruleId].rule_json,
      },
      t
    );
    if (/^RULE_\d+$/i.test(name)) {
      return t.automacao.page.executionHistory.unnamedRule;
    }
    return name;
  }
  return displayNameForExecution(row, t);
}

export function RuleExecutionHistoryPanel({ deviceId }: RuleExecutionHistoryPanelProps) {
  const { t, locale } = useLanguage();
  const h = t.automacao.page.executionHistory;
  const [rawRows, setRawRows] = useState<RuleExecutionRow[]>([]);
  const [configEvents, setConfigEvents] = useState<RuleConfigEvent[]>([]);
  const [procedureEvents, setProcedureEvents] = useState<ProcedureEventRow[]>([]);
  const [procedureStoreReady, setProcedureStoreReady] = useState(false);
  const [ruleNames, setRuleNames] = useState<RuleNameLookup>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procedureRuleIds = useMemo(
    () => procedureRuleIdsFromLookup(ruleNames),
    [ruleNames]
  );

  const timeline = useMemo((): TimelineItem[] => {
    const execItems: TimelineItem[] = collapseKeepaliveExecutions(rawRows)
      .filter((row) => {
        // Solo ocultar ACK de procedure cuando ya existe procedure_events (éxito oficial)
        if (!procedureStoreReady) return true;
        const rid = ruleIdFromCreatedBy(row.created_by);
        if (rid && procedureRuleIds.has(rid)) return false;
        return true;
      })
      .map((row) => ({
        kind: 'execution' as const,
        sortAt: row.startedAt || row.completed_at || row.created_at || '',
        key: `ex-${row.id}`,
        row,
      }));
    const cfgItems: TimelineItem[] = configEvents.map((event) => ({
      kind: 'config' as const,
      sortAt: event.created_at,
      key: `cfg-${event.id}`,
      event,
    }));
    const procItems: TimelineItem[] = procedureEvents.map((event) => ({
      kind: 'procedure' as const,
      sortAt: event.created_at,
      key: `pf-${event.id}`,
      event,
    }));
    return [...execItems, ...cfgItems, ...procItems]
      .sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0))
      .slice(0, HISTORY_LIMIT);
  }, [rawRows, configEvents, procedureEvents, procedureRuleIds, procedureStoreReady]);

  const load = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') {
      setRawRows([]);
      setConfigEvents([]);
      setProcedureEvents([]);
      setProcedureStoreReady(false);
      setRuleNames({});
      setError(null);
      return;
    }
    setLoading(true);
    const [{ rows: next, error: err }, cfg, proc, names] = await Promise.all([
      fetchRuleExecutions(deviceId, HISTORY_LIMIT),
      fetchRuleConfigEvents(deviceId, 40),
      fetchProcedureEvents(deviceId, 40),
      fetchRuleNameLookup(deviceId),
    ]);
    setRawRows(next);
    setConfigEvents(cfg);
    setProcedureEvents(proc.rows);
    setProcedureStoreReady(proc.available);
    setRuleNames(names);
    setError(err || proc.error);
    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!deviceId || deviceId === 'default_device') return;

    const onConfig = (e: Event) => {
      const detail = (e as CustomEvent<{ deviceId?: string }>).detail;
      if (detail?.deviceId && detail.deviceId !== deviceId) return;
      void fetchRuleConfigEvents(deviceId, 40).then(setConfigEvents);
    };
    window.addEventListener(RULE_CONFIG_HISTORY_EVENT, onConfig);

    const channel = supabase
      .channel(`rule-exec-history-${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'relay_commands',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as RuleExecutionRow;
          if (!row?.created_by?.startsWith('decision_engine_local#')) return;
          setRawRows((prev) => prependExecution(prev, row, RAW_BUFFER));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'procedure_events',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as ProcedureEventRow;
          if (!row?.rule_id) return;
          setProcedureEvents((prev) => prependProcedureEvent(prev, row, RAW_BUFFER));
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener(RULE_CONFIG_HISTORY_EVENT, onConfig);
      void supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const emptyDevice = !deviceId || deviceId === 'default_device';

  return (
    <div className="mt-8 bg-dark-surface border border-dark-border rounded-lg p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-dark-text flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-aqua-400" />
            {h.title}
          </h3>
          <p className="text-sm text-dark-textSecondary mt-1">{h.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || emptyDevice}
          className="p-2 rounded-lg text-aqua-400 hover:bg-dark-card disabled:opacity-40 transition-colors"
          title={h.refresh}
          aria-label={h.refresh}
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {emptyDevice && (
        <p className="text-sm text-dark-textSecondary">{h.selectCore}</p>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-2">
          {h.loadError}: {error}
        </p>
      )}

      {!emptyDevice && !error && timeline.length === 0 && !loading && (
        <p className="text-dark-textSecondary text-sm">{h.empty}</p>
      )}

      {timeline.length > 0 && (
        <ul className="space-y-2 mt-2">
          {timeline.map((item) => {
            if (item.kind === 'config') {
              const { event } = item;
              const name = displayNameForConfigEvent(event, t);
              const activated = event.event_type === 'enabled';
              return (
                <li
                  key={item.key}
                  className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-dark-border bg-dark-card/50 px-3 py-2.5 text-sm"
                >
                  <HwBadge accent={activated ? 'ok' : 'wait'}>
                    {activated ? h.badgeEnabled : h.badgeDisabled}
                  </HwBadge>
                  <span className="font-medium text-dark-text min-w-0 truncate max-w-[16rem] sm:max-w-sm">
                    {name}
                  </span>
                  <span className="text-dark-textSecondary">
                    {activated ? h.configEnabled : h.configDisabled}
                  </span>
                  <span className="ml-auto text-xs text-dark-textSecondary whitespace-nowrap">
                    {formatWhen(event.created_at, locale)}
                  </span>
                </li>
              );
            }

            if (item.kind === 'procedure') {
              const { event } = item;
              const ok = event.status === 'completed';
              const name = displayNameForProcedure(event, ruleNames, t);
              const what =
                ok
                  ? h.procedureCompleted
                  : event.reason === 'while_timeout'
                    ? h.procedureTimeout
                    : h.procedureAborted;
              return (
                <li
                  key={item.key}
                  className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-dark-border bg-dark-card/50 px-3 py-2.5 text-sm"
                >
                  <HwBadge accent={ok ? 'ok' : 'danger'}>
                    {ok ? h.badgeCompleted : h.badgeAborted}
                  </HwBadge>
                  <span className="font-medium text-dark-text min-w-0 truncate max-w-[16rem] sm:max-w-sm">
                    {name}
                  </span>
                  <span className="text-dark-textSecondary">{what}</span>
                  <span className="ml-auto text-xs text-dark-textSecondary whitespace-nowrap">
                    {formatWhen(event.created_at, locale)}
                  </span>
                </li>
              );
            }

            const row = item.row;
            const ok = row.status === 'completed';
            const failed = row.status === 'failed';
            const when = formatWhen(row.startedAt || row.completed_at || row.created_at, locale);
            const action = (row.action ?? '').toLowerCase();
            const turnedOn =
              action === 'on' || (action !== 'off' && row.current_state === true);
            const turnedOff =
              action === 'off' || (action !== 'on' && row.current_state === false);
            const whatHappened = turnedOn
              ? h.actionOn
              : turnedOff
                ? h.actionOff
                : h.actionRan;
            const name = humanExecutionName(row, ruleNames, t);

            return (
              <li
                key={item.key}
                className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-dark-border bg-dark-card/50 px-3 py-2.5 text-sm"
              >
                <HwBadge accent={ok ? 'ok' : failed ? 'danger' : 'wait'}>
                  {ok ? h.badgeOk : failed ? h.badgeFail : row.status}
                </HwBadge>
                <span className="font-medium text-dark-text min-w-0 truncate max-w-[16rem] sm:max-w-sm">
                  {name}
                </span>
                <span className="text-dark-textSecondary">{whatHappened}</span>
                <span className="ml-auto text-xs text-dark-textSecondary whitespace-nowrap">
                  {when}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
