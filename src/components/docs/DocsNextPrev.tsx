'use client';

import React from 'react';
import NavLink from '@/components/NavLink';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface DocsNextPrevProps {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export function DocsNextPrev({ prev, next }: DocsNextPrevProps) {
  if (!prev && !next) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-6 border-t border-dark-border">
      {prev ? (
        <NavLink
          href={prev.href}
          className="flex-1 group bg-dark-card border border-dark-border rounded-lg p-4 hover:border-aqua-500/50 transition-all"
        >
          <span className="flex items-center gap-1 text-xs text-dark-textSecondary mb-1">
            <ChevronLeftIcon className="w-4 h-4" />
            Previous
          </span>
          <span className="text-sm font-medium text-aqua-400 group-hover:text-aqua-300">{prev.label}</span>
        </NavLink>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <NavLink
          href={next.href}
          className="flex-1 group bg-dark-card border border-dark-border rounded-lg p-4 hover:border-aqua-500/50 transition-all text-right"
        >
          <span className="flex items-center justify-end gap-1 text-xs text-dark-textSecondary mb-1">
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </span>
          <span className="text-sm font-medium text-aqua-400 group-hover:text-aqua-300">{next.label}</span>
        </NavLink>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
