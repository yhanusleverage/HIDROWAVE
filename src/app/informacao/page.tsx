'use client';

import React, { useMemo, useState } from 'react';
import NavLink from '@/components/NavLink';
import BrandLogo from '@/components/BrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getInformacaoContent,
  type InformacaoQuickLinkId,
} from '@/lib/translations/informacao';
import {
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  LightBulbIcon,
  BeakerIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';

const QUICK_LINK_ICONS: Record<
  InformacaoQuickLinkId,
  { Icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  automacao: { Icon: Cog6ToothIcon, className: 'w-8 h-8 text-aqua-400 mb-3' },
  calibragem: { Icon: BeakerIcon, className: 'w-8 h-8 text-yellow-400 mb-3' },
  fundamentos: { Icon: BookOpenIcon, className: 'w-8 h-8 text-aqua-400 mb-3' },
};

const FLUXO_BORDERS = [
  'border-aqua-500',
  'border-primary-500',
  'border-emerald-500',
  'border-violet-500',
];

const GUIDE_BORDERS = ['border-aqua-500', 'border-primary-500', 'border-yellow-500'];

export default function InformacaoPage() {
  const { locale } = useLanguage();
  const c = useMemo(() => getInformacaoContent(locale), [locale]);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <BrandLogo variant="gradient" size={36} />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                {c.header.title}
              </h1>
              <p className="text-dark-textSecondary mt-1">{c.header.subtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {c.quickLinks.map((link) => {
            const { Icon, className } = QUICK_LINK_ICONS[link.id];
            return (
              <NavLink
                key={link.id}
                href={link.href}
                className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-lg shadow-lg p-6 hover:shadow-aqua-500/20 hover:border-aqua-500/50 transition-all"
              >
                <Icon className={className} />
                <h3 className="text-lg font-semibold text-dark-text mb-2">{link.title}</h3>
                <p className="text-sm text-dark-textSecondary">{link.description}</p>
              </NavLink>
            );
          })}
        </div>

        <div className="bg-dark-card border border-dark-border border-l-4 border-l-violet-500 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <AcademicCapIcon className="w-8 h-8 text-violet-400 shrink-0" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-dark-text mb-2">{c.technicalDocs.title}</h2>
              <p className="text-sm text-dark-textSecondary mb-4">{c.technicalDocs.body}</p>
              <div className="flex flex-wrap gap-3">
                <NavLink
                  href="/support"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-300 text-sm font-medium hover:bg-violet-500/25 transition-colors"
                >
                  <AcademicCapIcon className="w-4 h-4" />
                  {c.technicalDocs.supportCta}
                </NavLink>
                <NavLink
                  href="/processos"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
                >
                  <QueueListIcon className="w-4 h-4" />
                  {c.technicalDocs.processosCta}
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <LightBulbIcon className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-dark-text">{c.fluxo.title}</h2>
          </div>
          <div className="space-y-3 text-sm text-dark-textSecondary">
            {c.fluxo.steps.map((step, i) => (
              <div
                key={step.title}
                className={`border-l-4 ${FLUXO_BORDERS[i] ?? 'border-aqua-500'} pl-4 py-2`}
              >
                <h3 className="font-semibold text-dark-text mb-1">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <QuestionMarkCircleIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">{c.faq.title}</h2>
          </div>

          <div className="space-y-4">
            {c.faq.items.map((faq, index) => (
              <div key={faq.question} className="border border-dark-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-dark-surface transition-colors"
                >
                  <span className="font-medium text-dark-text">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-dark-textSecondary transition-transform shrink-0 ml-2 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFAQ === index && (
                  <div className="px-4 pb-4 text-dark-textSecondary text-sm">
                    {'answerKind' in faq && faq.answerKind === 'autoEc' ? (
                      <ol className="list-decimal list-inside space-y-2 mt-1">
                        {faq.steps.map((step, si) => (
                          <li key={si}>
                            {step.text}
                            {step.link ? (
                              <NavLink
                                href={step.link.href}
                                className="text-aqua-400 hover:underline"
                              >
                                {step.link.label}
                              </NavLink>
                            ) : null}
                            {step.textAfter ?? null}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      'answer' in faq ? faq.answer : null
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <DocumentTextIcon className="w-6 h-6 text-aqua-400" />
            <h2 className="text-xl font-semibold text-dark-text">{c.guides.title}</h2>
          </div>

          <div className="space-y-3">
            {c.guides.items.map((guide, i) => (
              <div
                key={guide.title}
                className={`border-l-4 ${GUIDE_BORDERS[i] ?? 'border-aqua-500'} pl-4 py-2`}
              >
                <h3 className="font-semibold text-dark-text mb-1">{guide.title}</h3>
                <p className="text-sm text-dark-textSecondary">{guide.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-dark-surface border border-dark-border rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-2">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-aqua-400" />
            <h3 className="text-lg font-semibold text-dark-text">{c.support.title}</h3>
          </div>
          <p className="text-dark-textSecondary mb-4 text-sm">{c.support.intro}</p>
          <div className="space-y-2 text-sm text-dark-textSecondary">
            <p>{c.support.email}</p>
            <p>{c.support.chat}</p>
          </div>
          <NavLink
            href="/planos"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-aqua-400 hover:text-aqua-300 transition-colors"
          >
            {c.support.plansCta}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
