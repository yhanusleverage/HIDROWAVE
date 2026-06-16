'use client';

import React from 'react';
import type { DocsSensorCardContent, DocsSubsectionContent } from '@/lib/translations/docs/types';
import { DocsFigure } from './DocsFigure';
import { HW_ACCENT_LEFT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

function SubsectionBlock({ subsection, accent }: { subsection: DocsSubsectionContent; accent: HwAccent }) {
  return (
    <div className="mt-4">
      <h4 className={`text-sm font-semibold ${HW_TEXT[accent]}`}>{subsection.title}</h4>
      {subsection.body && (
        <p className="text-sm text-dark-textSecondary mt-1 leading-relaxed">{subsection.body}</p>
      )}

      {subsection.bullets && subsection.bullets.length > 0 && (
        <ul className="mt-2 space-y-1">
          {subsection.bullets.map((b, i) => (
            <li
              key={i}
              className="text-sm text-dark-textSecondary/95 pl-2 border-l border-dark-border leading-relaxed"
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      {subsection.steps && subsection.steps.length > 0 && (
        <ol className="mt-2 space-y-2 list-decimal list-inside">
          {subsection.steps.map((s, i) => (
            <li key={i} className="text-sm text-dark-textSecondary leading-relaxed">
              <span className="font-semibold text-dark-text">{s.title}</span>
              {s.body ? <span className="block mt-1">{s.body}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function DocsSensorCard({ badge, title, accent, intro, image, subsections }: DocsSensorCardContent) {
  return (
    <div className={`rounded-lg border border-dark-border bg-dark-surface/60 border-l-4 pl-4 pr-4 py-3 ${HW_ACCENT_LEFT[accent]}`}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span
          className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded text-xs font-bold font-mono bg-dark-bg border border-dark-border ${HW_TEXT[accent]}`}
        >
          {badge}
        </span>
        <h3 className={`text-sm font-semibold ${HW_TEXT[accent]}`}>{title}</h3>
      </div>

      {intro && <p className="text-sm text-dark-textSecondary leading-relaxed mb-3">{intro}</p>}
      {image && <DocsFigure {...image} />}

      {subsections.map((subsection, i) => (
        <SubsectionBlock key={i} subsection={subsection} accent={accent} />
      ))}
    </div>
  );
}

