'use client';

import { useMemo, useState } from 'react';
import type { SimulatedLogEntry } from '@/lib/grow-cycle-timeline/types';
import { SIMULATION_RULES } from '@/lib/grow-cycle-timeline/simulation-engine';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

import { HW_PROCESS_LAYER_ACCENT, HW_TEXT } from '@/lib/design-tokens';
import type { ProcessLayer } from '@/lib/grow-cycle-timeline/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGrowCycleChrome } from '@/lib/translations/grow-cycle';

interface SimulationRulesPanelProps {
  log: SimulatedLogEntry[];
}

const LAYER_COLOR: Record<ProcessLayer, string> = {
  P1: HW_TEXT[HW_PROCESS_LAYER_ACCENT.P1],
  P2: HW_TEXT[HW_PROCESS_LAYER_ACCENT.P2],
  P3: HW_TEXT[HW_PROCESS_LAYER_ACCENT.P3],
  P4: HW_TEXT[HW_PROCESS_LAYER_ACCENT.P4],
};

export function SimulationRulesPanel({ log }: SimulationRulesPanelProps) {
  const [rulesOpen, setRulesOpen] = useState(true);
  const { locale } = useLanguage();
  const sim = useMemo(() => getGrowCycleChrome(locale).simulation, [locale]);

  return (
    <div className="space-y-4">
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <SectionHeader title={sim.logTitle} subtitle={sim.logSubtitle} accent="brand" />
        <div className="mt-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 bg-dark-surface/80 rounded-lg p-3 border border-dark-border">
          {log.length === 0 ? (
            <p className="text-dark-textSecondary">{sim.logEmpty}</p>
          ) : (
            log
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.id} className="leading-relaxed">
                  <span className={LAYER_COLOR[entry.layer] ?? 'text-dark-text'}>
                    S{entry.weekIndex}
                  </span>
                  <span className="text-dark-textSecondary"> · </span>
                  <span className="text-dark-text">{entry.message}</span>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-dark-surface/50 transition-colors text-left"
        >
          <span className="text-sm font-semibold text-dark-text">
            {sim.rulesToggle}
          </span>
          {rulesOpen ? (
            <ChevronUpIcon className="w-4 h-4 text-dark-textSecondary" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-dark-textSecondary" />
          )}
        </button>
        {rulesOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-dark-border pt-3">
            {SIMULATION_RULES.map((rule) => {
              const i18nRule = sim.rules[rule.layer];
              return (
                <div key={rule.layer}>
                  <p className={`text-xs font-semibold ${LAYER_COLOR[rule.layer]}`}>
                    {rule.layer} — {i18nRule.title}
                  </p>
                  <p className="text-xs text-dark-textSecondary mt-0.5 leading-relaxed">
                    {i18nRule.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
