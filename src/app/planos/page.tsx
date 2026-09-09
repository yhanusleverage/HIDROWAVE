'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPlanosContent,
  type PlanId,
  type PlanosAddonId,
} from '@/lib/translations/planos';
import {
  CheckCircleIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  WrenchScrewdriverIcon,
  AcademicCapIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

const ADDON_ICONS: Record<
  PlanosAddonId,
  React.ComponentType<{ className?: string }>
> = {
  install: WrenchScrewdriverIcon,
  calibration: SparklesIcon,
  training: AcademicCapIcon,
  monitoring: SignalIcon,
};

function PlanBadge({
  type,
  prefix,
  planName,
}: {
  type: PlanId;
  prefix: string;
  planName: string;
}) {
  const styles: Record<PlanId, string> = {
    free: 'bg-dark-surface text-dark-textSecondary border-dark-border',
    premium: 'bg-aqua-500/20 text-aqua-400 border-aqua-500/40',
    enterprise: 'bg-primary-500/20 text-primary-400 border-primary-500/40',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${styles[type]}`}
    >
      {prefix} {planName}
    </span>
  );
}

export default function PlanosPage() {
  const { userProfile } = useAuth();
  const { locale } = useLanguage();
  const c = useMemo(() => getPlanosContent(locale), [locale]);
  const currentPlan = (userProfile?.subscription_type || 'free') as PlanId;
  const currentPlanName =
    c.tiers.find((t) => t.id === currentPlan)?.name ?? c.tiers[0].name;

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <BrandLogo variant="gradient" size={40} />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                  {c.header.title}
                </h1>
                <p className="text-dark-textSecondary mt-1 text-sm max-w-xl">
                  {c.header.subtitle}
                </p>
              </div>
            </div>
            <PlanBadge
              type={currentPlan}
              prefix={c.currentPlanPrefix}
              planName={currentPlanName}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-12">
        <section>
          <h2 className="text-lg font-semibold text-dark-text mb-4">{c.tiersTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {c.tiers.map((tier) => {
              const isCurrent = currentPlan === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`rounded-xl p-6 flex flex-col ${
                    tier.highlighted
                      ? 'bg-dark-card border-2 border-aqua-500 shadow-lg shadow-aqua-500/20'
                      : 'bg-dark-card border border-dark-border'
                  }`}
                >
                  {tier.highlighted && (
                    <span className="text-xs font-semibold text-aqua-400 uppercase tracking-wide mb-2">
                      {c.recommendedBadge}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    {tier.id === 'enterprise' ? (
                      <BuildingOffice2Icon className="w-6 h-6 text-primary-400" />
                    ) : (
                      <SparklesIcon className="w-6 h-6 text-aqua-400" />
                    )}
                    <h3 className="text-xl font-bold text-dark-text">{tier.name}</h3>
                  </div>
                  <p className="text-sm text-dark-textSecondary mb-4">{tier.audience}</p>
                  <p className="text-2xl font-bold text-dark-text mb-1">{tier.price}</p>
                  <p className="text-xs text-dark-textSecondary mb-6">{tier.priceNote}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-dark-textSecondary">
                        <CheckCircleIcon className="w-4 h-4 text-aqua-400 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.ctaHref.startsWith('mailto:') ? (
                    <a
                      href={tier.ctaHref}
                      className={`block text-center py-3 px-4 rounded-lg font-medium transition-all ${
                        tier.ctaStyle === 'primary'
                          ? 'bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white shadow-lg hover:shadow-aqua-500/50'
                          : 'bg-dark-surface border border-dark-border text-dark-text hover:border-aqua-500/50'
                      }`}
                    >
                      {isCurrent && tier.id === 'free' ? c.planActiveCta : tier.cta}
                    </a>
                  ) : (
                    <Link
                      href={tier.ctaHref}
                      className="block text-center py-3 px-4 rounded-lg font-medium bg-dark-surface border border-dark-border text-dark-text hover:border-aqua-500/50 transition-all"
                    >
                      {isCurrent && tier.id === 'free' ? c.planActiveCta : tier.cta}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-dark-text mb-2">{c.addons.title}</h2>
          <p className="text-sm text-dark-textSecondary mb-6">{c.addons.subtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {c.addons.services.map((service) => {
              const Icon = ADDON_ICONS[service.id];
              return (
                <div
                  key={service.id}
                  className="bg-dark-card border border-dark-border rounded-lg p-5 hover:border-aqua-500/30 transition-colors"
                >
                  <Icon className="w-8 h-8 text-aqua-400 mb-3" />
                  <h3 className="font-semibold text-dark-text mb-2">{service.title}</h3>
                  <p className="text-sm text-dark-textSecondary">{service.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            <a
              href={c.addons.requestQuoteHref}
              className="inline-block bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-6 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50"
            >
              {c.addons.requestQuote}
            </a>
          </div>
        </section>

        <section className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-dark-text p-6 border-b border-dark-border">
            {c.comparison.title}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-surface text-dark-textSecondary">
                  <th className="text-left p-4 font-medium">{c.comparison.featureColumn}</th>
                  <th className="p-4 font-medium text-center">{c.comparison.columnFree}</th>
                  <th className="p-4 font-medium text-center text-aqua-400">
                    {c.comparison.columnPremium}
                  </th>
                  <th className="p-4 font-medium text-center">{c.comparison.columnEnterprise}</th>
                </tr>
              </thead>
              <tbody>
                {c.comparison.rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? 'bg-dark-card' : 'bg-dark-surface/50'}
                  >
                    <td className="p-4 text-dark-text font-medium">{row.feature}</td>
                    <td className="p-4 text-center text-dark-textSecondary">{row.free}</td>
                    <td className="p-4 text-center text-aqua-400/90">{row.premium}</td>
                    <td className="p-4 text-center text-dark-textSecondary">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-dark-textSecondary p-4 border-t border-dark-border">
            {c.comparison.footnote}
          </p>
        </section>

        <section className="text-center pb-8 space-y-3">
          <p className="text-dark-textSecondary text-sm">{c.footer.question}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/informacao"
              className="text-aqua-400 hover:text-aqua-300 text-sm font-medium transition-colors"
            >
              {c.footer.manualCta}
            </Link>
            <Link
              href="/quem-somos"
              className="text-aqua-400 hover:text-aqua-300 text-sm font-medium transition-colors"
            >
              {c.footer.aboutCta}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
