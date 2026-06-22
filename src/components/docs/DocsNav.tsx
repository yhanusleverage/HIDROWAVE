'use client';

import React, { useState } from 'react';
import NavLink from '@/components/NavLink';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { DocsNavTree } from '@/lib/translations/docs/types';

interface DocsNavProps {
  nav: DocsNavTree;
  collapsed?: boolean;
  onToggle?: () => void;
  collapseLabel: string;
  expandLabel: string;
}

function NavGroup({
  title,
  hubHref,
  hubLabel,
  items,
  pathname,
}: {
  title: string;
  hubHref: string;
  hubLabel: string;
  items: { href: string; label: string }[];
  pathname: string;
}) {
  const isInSection = pathname.startsWith(hubHref.split('/').slice(0, 2).join('/') || hubHref);
  const [open, setOpen] = useState(isInSection);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-left text-xs font-semibold uppercase tracking-wider text-dark-textSecondary hover:text-aqua-400 mb-2"
      >
        {open ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
        {title}
      </button>
      {open && (
        <ul className="space-y-1 pl-2 border-l border-dark-border ml-1">
          <li>
            <NavLink
              href={hubHref}
              className={`block text-sm py-1.5 px-2 rounded transition-colors ${
                pathname === hubHref
                  ? 'text-aqua-400 bg-aqua-500/10 font-medium'
                  : 'text-dark-textSecondary hover:text-dark-text hover:bg-dark-surface'
              }`}
            >
              {hubLabel}
            </NavLink>
          </li>
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                className={`block text-sm py-1.5 px-2 rounded transition-colors ${
                  pathname === item.href
                    ? 'text-aqua-400 bg-aqua-500/10 font-medium'
                    : 'text-dark-textSecondary hover:text-dark-text hover:bg-dark-surface'
                }`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocsNav({ nav, collapsed, onToggle, collapseLabel, expandLabel }: DocsNavProps) {
  const pathname = usePathname();

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="lg:hidden fixed bottom-4 left-4 z-40 bg-aqua-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      >
        {expandLabel}
      </button>
    );
  }

  return (
    <aside className="w-full lg:w-56 shrink-0">
      <div className="lg:sticky lg:top-4 bg-dark-card border border-dark-border rounded-lg p-4">
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="lg:hidden mb-3 text-xs text-dark-textSecondary hover:text-aqua-400"
          >
            {collapseLabel}
          </button>
        )}
        <NavGroup
          title={nav.sectionTitle}
          hubHref={nav.hubHref}
          hubLabel={nav.hubLabel}
          items={nav.items}
          pathname={pathname}
        />
        {nav.otherSection && (
          <NavGroup
            title={nav.otherSection.title}
            hubHref={nav.otherSection.hubHref}
            hubLabel={nav.otherSection.hubLabel}
            items={nav.otherSection.items}
            pathname={pathname}
          />
        )}
      </div>
    </aside>
  );
}
