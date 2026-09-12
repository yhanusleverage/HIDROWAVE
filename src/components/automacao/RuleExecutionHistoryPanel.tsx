'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeLocale, toBcp47, type AppLocale } from '@/lib/locale';
import { HwBadge } from '@/components/ui/HwBadge';
import type { HwAccent } from '@/lib/design-tokens';
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
  notifyProcedureFinishedUi,
  prependProcedureEvent,
  procedureRuleIdsFromLookup,
  type ProcedureEventRow,
  type RuleNameLookup,
} from '@/lib/rule-procedure-history';
import { resolveDecisionRuleDisplayName } from '@/lib/decision-rule-display-name';
import type { AppTranslations } from '@/lib/translations/app/types';

const HISTORY_LIMIT = 24;
const RAW_BUFFER = 100;
const BRIDGE_AUTO_DISABLE_BY = 'bridge:procedure_finished';

function buildNameHints(
  ruleNames: RuleNameLookup,
  configEvents: RuleConfigEvent[],
  procedureEvents: ProcedureEventRow[]
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [id, meta] of Object.entries(ruleNames)) {
    if (meta.rule_name?.trim()) m[id] = meta.rule_name.trim();
  }
  for (const e of configEvents) {
    if (e.rule_id && e.rule_name?.trim()) m[e.rule_id] = e.rule_name.trim();
  }
  for (const e of procedureEvents) {
    if (e.rule_id && e.rule_name?.trim()) m[e.rule_id] = e.rule_name.trim();
  }
  return m;
}

function ensureAutoDisableConfigEvent(
  prev: RuleConfigEvent[],
  proc: ProcedureEventRow,
  nameHints: Record<string, string>
): RuleConfigEvent[] {
  if (proc.status !== 'completed' || !proc.rule_id) return prev;
  const already = prev.some(
    (e) =>
      e.rule_id === proc.rule_id &&
      e.event_type === 'disabled' &&
      (Boolean(e.created_by?.startsWith('bridge:')) ||
        Math.abs(
          new Date(e.created_at).getTime() - new Date(proc.created_at).getTime()
        ) < 15_000)
  );
  if (already) return prev;
  const synthetic: RuleConfigEvent = {
    id: `local-auto-${proc.event_id || proc.id}`,
    device_id: proc.device_id,
    rule_id: proc.rule_id,
    rule_name: proc.rule_name ?? nameHints[proc.rule_id] ?? null,
    event_type: 'disabled',
    created_at: proc.created_at,
    created_by: BRIDGE_AUTO_DISABLE_BY,
  };
  return [synthetic, ...prev].slice(0, 100);
}

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

/** Fecha + hora absolutas (mismo formato de antes). */
function formatWhen(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(toBcp47(normalizeLocale(locale)), {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function railDotClass(accent: HwAccent): string {
  switch (accent) {
    case 'ok':
      return 'bg-emerald-400 ring-emerald-400/30';
    case 'danger':
      return 'bg-rose-400 ring-rose-400/30';
    case 'wait':
      return 'bg-amber-400 ring-amber-400/30';
    default:
      return 'bg-slate-400 ring-slate-400/25';
  }
}

function humanExecutionName(
  row: RuleExecutionRow,
  names: RuleNameLookup,
  t: AppTranslations,
  nameHints: Record<string, string>
): string {
  const ruleId = ruleIdFromCreatedBy(row.created_by);
  if (ruleId) {
    const hinted = nameHints[ruleId];
    if (hinted) return hinted;
    const meta = names[ruleId];
    const name = resolveDecisionRuleDisplayName(
      {
        rule_id: ruleId,
        rule_name: meta?.rule_name ?? null,
        rule_json: meta?.rule_json,
      },
      t
    );
    if (name && !/^RULE_\d+$/i.test(name)) {
      return name;
    }
    if (meta?.rule_name?.trim()) {
      return meta.rule_name.trim();
    }
  }
  return displayNameForExecution(row, t);
}

function ActivityRow({
  accent,
  category,
  title,
  detail,
  badge,
  whenIso,
  locale,
  isLast,
}: {
  accent: HwAccent;
  category: string;
  title: string;
  detail: string;
  badge: string;
  whenIso: string;
  locale: AppLocale;
  isLast: boolean;
}) {
  const when = formatWhen(whenIso, locale);
  return (
    <li className="relative flex gap-3 sm:gap-4">
      <div className="flex w-4 shrink-0 flex-col items-center">
        <span
          className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ${railDotClass(accent)}`}
          aria-hidden
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-dark-border/80" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <HwBadge accent={accent}>{badge}</HwBadge>
          <span className="min-w-0 max-w-[16rem] truncate text-sm font-medium text-dark-text sm:max-w-sm">
            {title}
          </span>
          <span className="text-sm text-dark-textSecondary">{detail}</span>
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-dark-textSecondary/60 sm:inline">
            {category}
          </span>
          <time
            className="ml-auto text-xs whitespace-nowrap tabular-nums text-dark-textSecondary"
            dateTime={whenIso}
          >
            {when}
          </time>
        </div>
      </div>
    </li>
  );
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

  const nameHints = useMemo(
    () => buildNameHints(ruleNames, configEvents, procedureEvents),
    [ruleNames, configEvents, procedureEvents]
  );

  const timeline = useMemo((): TimelineItem[] => {
    const procedureRuleIdsWithEvents = new Set(
      procedureEvents.map((e) => e.rule_id).filter(Boolean)
    );
    const execItems: TimelineItem[] = collapseKeepaliveExecutions(rawRows)
      .filter((row) => {
        if (!procedureStoreReady) return true;
        const rid = ruleIdFromCreatedBy(row.created_by);
        if (!rid) return true;
        if (procedureRuleIds.has(rid)) return false;
        if (procedureRuleIdsWithEvents.has(rid)) return false;
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
  }, [
    rawRows,
    configEvents,
    procedureEvents,
    procedureRuleIds,
    procedureStoreReady,
  ]);

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
    const hints = buildNameHints(names, cfg, proc.rows);
    let nextCfg = cfg;
    for (const pe of proc.rows) {
      if (pe.status === 'completed') {
        nextCfg = ensureAutoDisableConfigEvent(nextCfg, pe, hints);
      }
    }
    setRawRows(next);
    setConfigEvents(nextCfg);
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
          if (row.status === 'completed') {
            setConfigEvents((prev) =>
              ensureAutoDisableConfigEvent(prev, row, {
                ...(row.rule_name ? { [row.rule_id]: row.rule_name } : {}),
              })
            );
            notifyProcedureFinishedUi({
              deviceId: row.device_id || deviceId,
              ruleId: row.rule_id,
              ruleName: row.rule_name,
              status: row.status,
            });
            void fetchRuleNameLookup(deviceId).then(setRuleNames);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rule_config_events',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const event = payload.new as RuleConfigEvent;
          if (!event?.rule_id) return;
          setConfigEvents((prev) => {
            if (prev.some((e) => e.id === event.id)) return prev;
            return [event, ...prev].slice(0, 100);
          });
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
    <div className="mt-8 overflow-hidden rounded-xl border border-dark-border bg-dark-surface">
      <div className="flex items-start justify-between gap-3 border-b border-dark-border/80 bg-dark-card/30 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="flex items-center text-base font-semibold tracking-tight text-dark-text sm:text-lg">
            <ClockIcon className="mr-2 h-5 w-5 shrink-0 text-aqua-400" />
            {h.title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-dark-textSecondary">
            {h.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || emptyDevice}
          className="shrink-0 rounded-lg p-2 text-aqua-400 transition-colors hover:bg-dark-card disabled:opacity-40"
          title={h.refresh}
          aria-label={h.refresh}
        >
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 py-4 sm:px-6">
        {emptyDevice && (
          <p className="text-sm text-dark-textSecondary">{h.selectCore}</p>
        )}

        {error && (
          <p className="mb-2 text-sm text-red-400">
            {h.loadError}: {error}
          </p>
        )}

        {!emptyDevice && !error && timeline.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-dark-textSecondary">{h.empty}</p>
        )}

        {timeline.length > 0 && (
          <ol className="m-0 list-none p-0">
            {timeline.map((item, idx) => {
              const isLast = idx === timeline.length - 1;

              if (item.kind === 'config') {
                const { event } = item;
                const name = displayNameForConfigEvent(event, t);
                const activated = event.event_type === 'enabled';
                const autoDisabled =
                  !activated &&
                  typeof event.created_by === 'string' &&
                  event.created_by.startsWith('bridge:');
                return (
                  <ActivityRow
                    key={item.key}
                    accent={activated ? 'ok' : 'wait'}
                    category={h.categoryConfig}
                    title={name}
                    detail={
                      activated
                        ? h.configEnabled
                        : autoDisabled
                          ? h.configDisabledAuto
                          : h.configDisabled
                    }
                    badge={activated ? h.badgeEnabled : h.badgeDisabled}
                    whenIso={event.created_at}
                    locale={locale}
                    isLast={isLast}
                  />
                );
              }

              if (item.kind === 'procedure') {
                const { event } = item;
                const ok = event.status === 'completed';
                const name = displayNameForProcedure(event, ruleNames, t, nameHints);
                const detail =
                  ok
                    ? h.procedureCompleted
                    : event.reason === 'while_timeout'
                      ? h.procedureTimeout
                      : h.procedureAborted;
                return (
                  <ActivityRow
                    key={item.key}
                    accent={ok ? 'ok' : 'danger'}
                    category={h.categoryProcedure}
                    title={name}
                    detail={detail}
                    badge={ok ? h.badgeCompleted : h.badgeAborted}
                    whenIso={event.created_at}
                    locale={locale}
                    isLast={isLast}
                  />
                );
              }

              const row = item.row;
              const ok = row.status === 'completed';
              const failed = row.status === 'failed';
              const whenIso = row.startedAt || row.completed_at || row.created_at || '';
              const action = (row.action ?? '').toLowerCase();
              const turnedOn =
                action === 'on' || (action !== 'off' && row.current_state === true);
              const turnedOff =
                action === 'off' || (action !== 'on' && row.current_state === false);
              const detail = turnedOn
                ? h.actionOn
                : turnedOff
                  ? h.actionOff
                  : h.actionRan;
              const name = humanExecutionName(row, ruleNames, t, nameHints);
              const accent: HwAccent = ok ? 'ok' : failed ? 'danger' : 'wait';

              return (
                <ActivityRow
                  key={item.key}
                  accent={accent}
                  category={h.categoryActuator}
                  title={name}
                  detail={detail}
                  badge={ok ? h.badgeOk : failed ? h.badgeFail : row.status}
                  whenIso={whenIso}
                  locale={locale}
                  isLast={isLast}
                />
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
