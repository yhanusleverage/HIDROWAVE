'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type AutomacaoTabId = 'timeline' | 'procedures' | 'rules' | 'ec' | 'ph';

const TABS: { id: AutomacaoTabId; label: string; subtitle: string }[] = [
  { id: 'procedures', label: 'Procedimentos', subtitle: 'P1 — tipagem e builder' },
  { id: 'ec', label: 'Auto EC', subtitle: 'P2 — controle nutricional' },
  { id: 'ph', label: 'Auto pH', subtitle: 'P3 — correção ácido/base' },
  { id: 'rules', label: 'Regras e Motor', subtitle: 'P4 — decision_rules' },
  { id: 'timeline', label: 'Ciclo de Cultivo', subtitle: 'Receita — semanas S0…Sn' },
];

function parseTab(value: string | null): AutomacaoTabId {
  if (
    value === 'timeline' ||
    value === 'procedures' ||
    value === 'ec' ||
    value === 'ph' ||
    value === 'rules'
  ) {
    return value;
  }
  return 'rules';
}

interface AutomacaoTabsProps {
  activeTab: AutomacaoTabId;
  onTabChange: (tab: AutomacaoTabId) => void;
}

export function AutomacaoTabs({ activeTab, onTabChange }: AutomacaoTabsProps) {
  return (
    <div className="mb-6 border-b border-dark-border w-full">
      <nav
        className="grid grid-cols-5 w-full -mb-px"
        aria-label="Secções de automação"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`min-w-0 px-2 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors rounded-t-lg text-center ${
                selected
                  ? 'border-aqua-400 text-aqua-300 bg-dark-card/80'
                  : 'border-transparent text-dark-textSecondary hover:text-dark-text hover:border-dark-border'
              }`}
            >
              <span className="block truncate">{tab.label}</span>
              <span className="block text-[10px] font-normal opacity-70 mt-0.5 truncate hidden sm:block">
                {tab.subtitle}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function useAutomacaoTab(): [AutomacaoTabId, (tab: AutomacaoTabId) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AutomacaoTabId>(() =>
    parseTab(searchParams.get('tab'))
  );

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get('tab')));
  }, [searchParams]);

  const setTab = useCallback(
    (tab: AutomacaoTabId) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return [activeTab, setTab];
}
