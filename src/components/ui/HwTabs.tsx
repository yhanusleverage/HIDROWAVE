'use client';

import React from 'react';

export interface HwTab {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface HwTabsProps {
  tabs: HwTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function HwTabs({ tabs, activeId, onChange, className = '' }: HwTabsProps) {
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1 border-b border-dark-border mb-4"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg',
                'disabled:opacity-50 disabled:pointer-events-none',
                isSelected
                  ? 'border-aqua-500 text-aqua-300 bg-aqua-500/10'
                  : 'border-transparent text-dark-textSecondary hover:text-dark-text hover:bg-dark-surface',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab && (
        <div
          role="tabpanel"
          id={`panel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
