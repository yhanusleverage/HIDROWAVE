'use client';

import React from 'react';
import type { DocsStepContent } from '@/lib/translations/docs/types';

interface DocsStepListProps {
  steps: DocsStepContent[];
}

export function DocsStepList({ steps }: DocsStepListProps) {
  return (
    <ol className="space-y-4 my-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-aqua-500/20 border border-aqua-500/40 text-aqua-400 text-sm font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="pt-0.5">
            <p className="font-semibold text-dark-text text-sm">{step.title}</p>
            <p className="text-sm text-dark-textSecondary mt-1 leading-relaxed">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
