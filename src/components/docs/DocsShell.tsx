'use client';

import React, { useState, useEffect } from 'react';
import NavLink from '@/components/NavLink';
import { DocsNav } from './DocsNav';
import { DocsPageHeader } from './DocsPageHeader';
import { DocsSection } from './DocsSection';
import { DocsNextPrev } from './DocsNextPrev';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { HW_ACCENT_TOP, HW_TEXT, type HwAccent } from '@/lib/design-tokens';
import type { DocsPageContent, DocsNavTree, DocsShellLabels } from '@/lib/translations/docs/types';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface DocsShellProps {
  page: DocsPageContent;
  nav: DocsNavTree;
  labels: DocsShellLabels;
  sectionHref: string;
  sectionLabel: string;
}

function DocsCard({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent: HwAccent;
}) {
  return (
    <NavLink
      href={href}
      className={`block bg-dark-card border border-dark-border border-t-2 rounded-lg p-5 hover:shadow-lg transition-all ${HW_ACCENT_TOP[accent]}`}
    >
      <h3 className={`font-semibold mb-2 ${HW_TEXT[accent]}`}>{title}</h3>
      <p className="text-sm text-dark-textSecondary leading-relaxed">{description}</p>
    </NavLink>
  );
}

function DocsToc({ sections, label }: { sections: DocsPageContent['sections']; label: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length <= 1) return null;

  return (
    <aside className="hidden xl:block w-48 shrink-0">
      <div className="sticky top-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-dark-textSecondary mb-3">
          {label}
        </p>
        <ul className="space-y-2 border-l border-dark-border pl-3">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`block text-xs py-0.5 transition-colors ${
                  activeId === s.id
                    ? 'text-aqua-400 font-medium -ml-px border-l-2 border-aqua-400 pl-2'
                    : 'text-dark-textSecondary hover:text-dark-text'
                }`}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function DocsShell({
  page,
  nav,
  labels,
  sectionHref,
  sectionLabel,
}: DocsShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg">
      <DocsPageHeader
        title={page.title}
        subtitle={page.subtitle}
        breadcrumb={page.breadcrumb}
        sectionHref={sectionHref}
        sectionLabel={sectionLabel}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          <div className={navOpen ? 'block' : 'hidden lg:block'}>
            <DocsNav
              nav={nav}
              collapsed={!navOpen}
              onToggle={() => setNavOpen(!navOpen)}
              collapseLabel={labels.collapseNav}
              expandLabel={labels.expandNav}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 sm:p-8">
              {page.sections.map((section) => (
                <DocsSection key={section.id} section={section} />
              ))}

              {page.cards && page.cards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {page.cards.map((card) => (
                    <DocsCard key={card.href} {...card} />
                  ))}
                </div>
              )}

              {page.help && (
                <InstrumentCard accent="brand" className="mt-8">
                  <div className="flex items-start gap-3">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-aqua-400 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-dark-text mb-2">{page.help.title}</h3>
                      <p className="text-sm text-dark-textSecondary mb-3">{page.help.body}</p>
                      <p className="text-sm text-dark-textSecondary">
                        {page.help.emailLabel}:{' '}
                        <a href={`mailto:${page.help.email}`} className="text-aqua-400 hover:underline">
                          {page.help.email}
                        </a>
                      </p>
                      <NavLink
                        href={page.help.plansHref}
                        className="inline-block mt-3 text-sm font-medium text-aqua-400 hover:text-aqua-300"
                      >
                        {page.help.plansLabel} →
                      </NavLink>
                    </div>
                  </div>
                </InstrumentCard>
              )}

              <DocsNextPrev prev={page.prev} next={page.next} />
            </div>
          </div>

          <DocsToc sections={page.sections} label={labels.onThisPage} />
        </div>
      </div>

      {!navOpen && (
        <DocsNav
          nav={nav}
          collapsed
          onToggle={() => setNavOpen(true)}
          collapseLabel={labels.collapseNav}
          expandLabel={labels.expandNav}
        />
      )}
    </div>
  );
}
