'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { toBcp47 } from '@/lib/locale';
import { HwBadge } from '@/components/ui/HwBadge';
import { supabase } from '@/lib/supabase';
import {
  displayNameForExecution,
  fetchRuleExecutions,
  prependExecution,
  ruleIdFromCreatedBy,
  type RuleExecutionRow,
} from '@/lib/rule-execution-history';

const HISTORY_LIMIT = 20;

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

export function RuleExecutionHistoryPanel({ deviceId }: RuleExecutionHistoryPanelProps) {
  const { t, locale } = useLanguage();
  const h = t.automacao.page.executionHistory;
  const [rows, setRows] = useState<RuleExecutionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deviceId || deviceId === 'default_device') {
      setRows([]);
      setError(null);
      return;
    }
    setLoading(true);
    const { rows: next, error: err } = await fetchRuleExecutions(deviceId, HISTORY_LIMIT);
    setRows(next);
    setError(err);
    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!deviceId || deviceId === 'default_device') return;

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
          setRows((prev) => prependExecution(prev, row, HISTORY_LIMIT));
        }
      )
      .subscribe();

    return () => {
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
        <p className="text-sm text-red-400 mb-2">{h.loadError}: {error}</p>
      )}

      {!emptyDevice && !error && rows.length === 0 && !loading && (
        <p className="text-dark-textSecondary text-sm">{h.empty}</p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2 mt-2">
          {rows.map((row) => {
            const ruleId = ruleIdFromCreatedBy(row.created_by);
            const ok = row.status === 'completed';
            const failed = row.status === 'failed';
            const when = formatWhen(row.completed_at ?? row.created_at, locale);
            const action = (row.action ?? '—').toLowerCase();
            const stateLabel =
              row.current_state === true
                ? h.stateOn
                : row.current_state === false
                  ? h.stateOff
                  : '—';

            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-dark-border bg-dark-card/50 px-3 py-2.5 text-sm"
              >
                <HwBadge accent={ok ? 'ok' : failed ? 'danger' : 'wait'}>
                  {ok ? h.badgeOk : failed ? h.badgeFail : row.status}
                </HwBadge>
                <HwBadge accent="brand">{h.badgeRule}</HwBadge>
                <span className="font-medium text-dark-text min-w-0 truncate max-w-[14rem] sm:max-w-xs">
                  {displayNameForExecution(row, t)}
                </span>
                {ruleId && (
                  <span className="text-[11px] font-mono text-dark-textSecondary/80 truncate max-w-[10rem]">
                    {ruleId}
                  </span>
                )}
                <span className="text-dark-textSecondary">
                  R{row.relay_number} · {action} · {stateLabel}
                </span>
                {row.target_device_id && (
                  <span className="text-[11px] font-mono text-dark-textSecondary/70 truncate max-w-[8rem]">
                    {row.target_device_id}
                  </span>
                )}
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
