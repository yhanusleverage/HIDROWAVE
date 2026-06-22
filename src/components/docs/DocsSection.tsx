'use client';

import React from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { DocsCallout } from './DocsCallout';
import { DocsStepList } from './DocsStepList';
import { DocsFigure } from './DocsFigure';
import { DocsPriorityStack } from './DocsPriorityStack';
import { DocsSensorCard } from './DocsSensorCard';
import type { DocsSectionContent } from '@/lib/translations/docs/types';
import { HW_ACCENT_LEFT, HW_TEXT, type HwAccent } from '@/lib/design-tokens';

interface DocsSectionProps {
  section: DocsSectionContent;
}

function LayerBlock({ title, body, accent }: { title: string; body: string; accent: HwAccent }) {
  return (
    <div className={`border-l-4 pl-4 py-3 mb-3 rounded-r-lg bg-dark-surface/50 ${HW_ACCENT_LEFT[accent]}`}>
      <h4 className={`text-sm font-semibold ${HW_TEXT[accent]}`}>{title}</h4>
      <p className="text-sm text-dark-textSecondary mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

export function DocsSection({ section }: DocsSectionProps) {
  const accent = section.accent ?? 'brand';

  return (
    <section id={section.id} className="scroll-mt-24 mb-10">
      <SectionHeader title={section.title} subtitle={section.subtitle} accent={accent} />

      {section.paragraphs?.map((p, i) => (
        <p key={i} className="text-sm text-dark-textSecondary leading-relaxed mb-3">
          {p}
        </p>
      ))}

      {section.image && <DocsFigure {...section.image} />}

      {section.priorityStack != null && section.priorityStack.length > 0 && (
        <DocsPriorityStack rows={section.priorityStack} />
      )}

      {section.sensorCards?.length ? (
        <div className="my-6 space-y-4">
          {section.sensorCards.map((card, i) => (
            <DocsSensorCard key={i} {...card} />
          ))}
        </div>
      ) : null}

      {section.layers?.map((layer, i) => (
        <LayerBlock key={i} {...layer} />
      ))}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-2 my-4 text-sm text-dark-textSecondary">
          {section.bullets.map((b, i) => (
            <li key={i} className="leading-relaxed">
              {b}
            </li>
          ))}
        </ul>
      )}

      {section.steps && section.steps.length > 0 && <DocsStepList steps={section.steps} />}

      {section.code && (
        <InstrumentCard accent="neutral" className="my-4">
          <pre className="text-xs text-aqua-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
            {section.code}
          </pre>
        </InstrumentCard>
      )}

      {section.stateFlow && section.stateFlow.length > 0 && (
        <InstrumentCard accent={accent} tinted className="my-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {section.stateFlow.map((state, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-dark-textSecondary">→</span>}
                <span className={`px-2 py-1 rounded border font-mono text-xs ${HW_TEXT[accent]} border-current/30 bg-dark-bg/50`}>
                  {state}
                </span>
              </React.Fragment>
            ))}
          </div>
        </InstrumentCard>
      )}

      {section.table && (
        <div className="overflow-x-auto my-4 rounded-lg border border-dark-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-surface border-b border-dark-border">
                {section.table.headers.map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left font-semibold text-dark-text">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-dark-border last:border-0">
                  {row.cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-dark-textSecondary">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.callouts?.map((callout, i) => (
        <DocsCallout key={i} {...callout} />
      ))}
    </section>
  );
}
