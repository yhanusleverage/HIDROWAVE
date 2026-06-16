'use client';

import React from 'react';
import type { DocsPriorityRowContent } from '@/lib/translations/docs/types';
import { HW_ACCENT_LEFT, HW_TEXT } from '@/lib/design-tokens';

export interface DocsPriorityStackProps {
  rows: DocsPriorityRowContent[];
}

export function DocsPriorityStack({ rows }: DocsPriorityStackProps) {
  return (
    <div className="my-6 space-y-3">
      {rows.map((row) => (
        <div
          key={row.priority}
          className={`rounded-lg border border-dark-border bg-dark-surface/60 border-l-4 pl-4 pr-4 py-3 ${HW_ACCENT_LEFT[row.accent]}`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded text-xs font-bold font-mono bg-dark-bg border border-dark-border ${HW_TEXT[row.accent]}`}
            >
              P{row.priority}
            </span>
            <h4 className={`text-sm font-semibold ${HW_TEXT[row.accent]}`}>{row.label}</h4>
          </div>
          <p className="text-sm text-dark-textSecondary leading-relaxed">{row.body}</p>
          {row.examples != null && row.examples.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.examples.map((ex, i) => (
                <li key={i} className="text-xs font-mono text-dark-textSecondary/90 pl-2 border-l border-dark-border">
                  {ex}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
