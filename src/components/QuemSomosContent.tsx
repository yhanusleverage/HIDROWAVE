'use client';

import React, { useMemo, useState } from 'react';
import NavLink from '@/components/NavLink';
import BrandLogo from '@/components/BrandLogo';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HW_TEXT } from '@/lib/design-tokens';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getQuemSomosContent,
  type QuemSomosElement,
} from '@/lib/translations/quem-somos';
import {
  ArrowRightIcon,
  BoltIcon,
  BeakerIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  SignalIcon,
  SparklesIcon,
  SunIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const ELEMENT_ICONS: Record<
  QuemSomosElement['id'],
  React.ComponentType<{ className?: string }>
> = {
  electronics: CpuChipIcon,
  hydraulics: BeakerIcon,
  chemistry: SparklesIcon,
  nutrition: ShieldCheckIcon,
  environment: SunIcon,
  telemetry: ChartBarIcon,
  connectivity: SignalIcon,
};

function ElementCard({
  item,
  howItWorks,
}: {
  item: QuemSomosElement;
  howItWorks: string;
}) {
  const [techOpen, setTechOpen] = useState(false);
  const Icon = ELEMENT_ICONS[item.id];

  return (
    <InstrumentCard accent={item.accent} tinted className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-dark-bg/50">
          <Icon className={`w-6 h-6 ${HW_TEXT[item.accent]}`} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-dark-textSecondary/70">
            {item.element}
          </p>
          <h3 className="font-bold text-dark-text">{item.title}</h3>
        </div>
      </div>
      <p className="text-xs text-dark-textSecondary mb-2 font-medium">{item.subtitle}</p>
      <p className="text-sm text-dark-textSecondary leading-relaxed mb-2 flex-1">{item.plain}</p>
      <p className="text-xs text-dark-textSecondary/70 italic border-t border-dark-border/50 pt-3 mb-3">
        {item.tagline}
      </p>
      <button
        type="button"
        onClick={() => setTechOpen((v) => !v)}
        className={`flex items-center gap-1 text-xs ${HW_TEXT.neutral} hover:opacity-80 mb-3`}
      >
        {howItWorks}
        {techOpen ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
      </button>
      {techOpen && (
        <p className="text-xs text-dark-textSecondary/80 mb-3 border border-dark-border rounded px-2 py-1.5 bg-dark-bg/40 leading-relaxed">
          {item.technicalDetail}
        </p>
      )}
      <NavLink
        href={item.href}
        className={`inline-flex items-center gap-1 text-sm font-medium ${HW_TEXT[item.accent]} hover:opacity-90 mt-auto`}
      >
        {item.ctaLabel}
        <ArrowRightIcon className="w-3.5 h-3.5" />
      </NavLink>
    </InstrumentCard>
  );
}

export default function QuemSomosContent() {
  const { locale } = useLanguage();
  const c = useMemo(() => getQuemSomosContent(locale), [locale]);
  const { ui } = c;

  return (
    <>
      <header className="relative overflow-hidden bg-dark-card border-b border-dark-border shadow-lg">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(34, 211, 238, 0.25), transparent), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(139, 92, 246, 0.15), transparent)',
          }}
        />
        <div className="relative max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <BrandLogo variant="gradient" size={48} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aqua-400/90 mb-3">
            {c.hero.eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-dark-text leading-tight mb-4">
            {c.hero.title}{' '}
            <span className="bg-gradient-to-r from-aqua-400 via-primary-400 to-violet-400 bg-clip-text text-transparent">
              {c.hero.titleHighlight}
            </span>
          </h1>
          <p className="text-lg text-dark-textSecondary max-w-2xl mx-auto leading-relaxed">
            {c.hero.subtitle}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-14">
        <section>
          <InstrumentCard accent="brand" tinted>
            <div className="flex items-start gap-4">
              <BoltIcon className="w-8 h-8 text-aqua-400 shrink-0 mt-1" />
              <div>
                <SectionHeader title={c.mission.title} accent="brand" className="mb-3" />
                <p className="text-dark-textSecondary leading-relaxed mb-4">
                  <strong className="text-dark-text">{c.mission.body}</strong>
                </p>
                <p className="text-sm text-dark-textSecondary leading-relaxed border-l-4 border-aqua-500/60 pl-4">
                  {c.mission.aside}
                </p>
              </div>
            </div>
          </InstrumentCard>
        </section>

        <section id="filosofia" aria-labelledby="manifesto-heading">
          <InstrumentCard accent="ok" tinted className="relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              aria-hidden
              style={{
                background:
                  'radial-gradient(ellipse 70% 50% at 0% 50%, rgba(34, 211, 238, 0.2), transparent)',
              }}
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aqua-400/90 mb-4">
                {c.manifesto.eyebrow}
              </p>
              <blockquote className="border-l-4 border-aqua-500/70 pl-5 sm:pl-6">
                <h2
                  id="manifesto-heading"
                  className="text-2xl sm:text-3xl font-bold text-dark-text leading-snug mb-2"
                >
                  {c.manifesto.lead}
                </h2>
                <p className="text-lg text-aqua-400/95 font-medium mb-6">
                  {c.manifesto.subtitle}
                </p>
                <div className="space-y-4 text-dark-textSecondary leading-relaxed">
                  {c.manifesto.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="text-sm sm:text-base">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </blockquote>
            </div>
          </InstrumentCard>
        </section>

        <section id="linha-produto" aria-labelledby="product-line-heading">
          <div className="text-center mb-8">
            <h2 id="product-line-heading" className="text-2xl font-bold text-dark-text mb-2">
              {c.productLine.title}
            </h2>
            <p className="text-sm text-dark-textSecondary max-w-xl mx-auto">
              {c.productLine.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {c.productLine.modules.map((mod) => (
              <InstrumentCard key={mod.name} accent={mod.accent} tinted className="flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wide text-dark-textSecondary/70 mb-1">
                  {mod.role}
                </p>
                <h3 className={`text-lg font-bold mb-2 ${HW_TEXT[mod.accent]}`}>{mod.name}</h3>
                <p className="text-sm text-dark-textSecondary leading-relaxed">{mod.body}</p>
              </InstrumentCard>
            ))}
          </div>
        </section>

        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-dark-text mb-2">{ui.trustTitle}</h2>
            <p className="text-sm text-dark-textSecondary max-w-xl mx-auto">{ui.trustSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {c.socialProof.map((item) => (
              <InstrumentCard key={item.title} accent={item.accent} tinted className="flex flex-col">
                <SectionHeader title={item.title} accent={item.accent} />
                <p className="text-sm text-dark-textSecondary leading-relaxed mb-2 flex-1">
                  {item.description}
                </p>
                <p className={`text-xs font-medium ${HW_TEXT[item.accent]} mb-3`}>{item.highlight}</p>
                <NavLink
                  href={item.href}
                  className={`inline-flex items-center gap-1 text-sm font-medium ${HW_TEXT[item.accent]} hover:opacity-90`}
                >
                  {item.ctaLabel}
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </NavLink>
              </InstrumentCard>
            ))}
          </div>
        </section>

        <section>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-dark-text mb-2">{ui.beforeAfterTitle}</h2>
            <p className="text-sm text-dark-textSecondary max-w-lg mx-auto">{ui.beforeAfterSubtitle}</p>
          </div>
          <InstrumentCard accent="neutral">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border text-dark-textSecondary">
                    <th className="text-left py-2 pr-4 font-medium">{ui.withoutHw}</th>
                    <th className="text-left py-2 font-medium text-aqua-400">{ui.withHw}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.beforeAfter.map((row) => (
                    <tr key={row.without} className="border-b border-dark-border/50 last:border-0">
                      <td className="py-3 pr-4 text-dark-textSecondary">{row.without}</td>
                      <td className="py-3 text-dark-text">{row.with}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InstrumentCard>
        </section>

        <section id="elementos">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-dark-text mb-2">{ui.elementsTitle}</h2>
            <p className="text-sm text-dark-textSecondary max-w-xl mx-auto">{ui.elementsSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {c.elements.map((item) => (
              <ElementCard key={item.id} item={item} howItWorks={ui.howItWorks} />
            ))}
          </div>
        </section>

        <section>
          <InstrumentCard accent="brand" tinted>
            <div className="flex items-center gap-2 mb-6">
              <CloudIcon className="w-5 h-5 text-aqua-400 shrink-0" />
              <div>
                <h2 className="text-xl font-semibold text-dark-text">{ui.journeyTitle}</h2>
                <p className="text-sm text-dark-textSecondary mt-0.5">{ui.journeySubtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {c.journey.map((item, index) => (
                <div key={item.step} className="relative">
                  <div className="bg-dark-card border border-dark-border rounded-lg p-4 h-full">
                    <span className="text-2xl font-bold text-aqua-500/40">{item.step}</span>
                    <h3 className="font-semibold text-dark-text mt-1 mb-2">{item.layer}</h3>
                    <p className="text-xs text-dark-textSecondary leading-relaxed">{item.detail}</p>
                  </div>
                  {index < c.journey.length - 1 && (
                    <ArrowRightIcon
                      className="hidden lg:block absolute top-1/2 -right-3 w-5 h-5 text-dark-textSecondary/40 -translate-y-1/2 z-10"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
          </InstrumentCard>
        </section>

        <section>
          <SectionHeader title={ui.promisesTitle} accent="brand" className="mb-4" />
          <ul className="space-y-3">
            {c.promises.map((promise) => (
              <li
                key={promise}
                className="flex items-start gap-3 bg-dark-card border border-dark-border rounded-lg px-4 py-3"
              >
                <CheckCircleIcon className="w-4 h-4 text-aqua-400 shrink-0 mt-0.5" />
                <span className="text-sm text-dark-textSecondary leading-relaxed">{promise}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-center bg-gradient-to-r from-aqua-500/10 via-primary-500/10 to-violet-500/10 border border-aqua-500/30 rounded-xl p-8">
          <h2 className="text-xl font-bold text-dark-text mb-2">{c.cta.title}</h2>
          <p className="text-sm text-dark-textSecondary mb-6 max-w-md mx-auto">{c.cta.subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <NavLink
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/40"
            >
              {ui.ctaDashboard}
              <ArrowRightIcon className="w-4 h-4" />
            </NavLink>
            <NavLink
              href="/planos"
              className="inline-flex items-center gap-2 bg-dark-card border border-dark-border text-dark-text hover:border-aqua-500/50 font-medium py-3 px-6 rounded-lg transition-all"
            >
              {ui.ctaPlans}
            </NavLink>
            <NavLink
              href="/informacao"
              className="text-sm text-aqua-400 hover:text-aqua-300 transition-colors"
            >
              {ui.ctaManual}
            </NavLink>
          </div>
        </section>

        <footer className="text-center pb-6">
          <p className="text-xs text-dark-textSecondary/60">{ui.footer}</p>
        </footer>
      </div>
    </>
  );
}
