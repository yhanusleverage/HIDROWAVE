'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import {
  CheckCircleIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  WrenchScrewdriverIcon,
  AcademicCapIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

type PlanId = 'free' | 'premium' | 'enterprise';

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Operação Inicial',
  premium: 'Pro Comercial',
  enterprise: 'Enterprise Estufa',
};

const TIERS = [
  {
    id: 'free' as PlanId,
    name: 'Operação Inicial',
    audience: '1 estufa piloto',
    price: 'Incluído na compra do kit',
    priceNote: 'Ideal para validar o sistema na sua operação',
    cta: 'Já estou usando',
    ctaHref: '/dashboard',
    ctaStyle: 'secondary' as const,
    highlighted: false,
    features: [
      '1 master ESP32 + dashboard em tempo real',
      'Auto EC e Auto pH básicos',
      'Histórico de sensores: 30 dias',
      'Suporte por email (resposta em até 48h)',
    ],
  },
  {
    id: 'premium' as PlanId,
    name: 'Pro Comercial',
    audience: 'Estufa em produção',
    price: 'Sob consulta',
    priceNote: 'A partir de R$ 299/mês por site',
    cta: 'Solicitar upgrade Pro',
    ctaHref:
      'mailto:suporte@hydrowave.com?subject=Upgrade%20HydroWave%20Pro%20Comercial&body=Olá,%20gostaria%20de%20informações%20sobre%20o%20plano%20Pro%20Comercial.',
    ctaStyle: 'primary' as const,
    highlighted: true,
    features: [
      'Até vários dispositivos por conta (conforme contrato)',
      'Histórico completo: 12 meses',
      'Alertas SMS e email prioritários',
      'Calibragem de bombas assistida remotamente',
      'Suporte comercial em horário estendido',
    ],
  },
  {
    id: 'enterprise' as PlanId,
    name: 'Enterprise Estufa',
    audience: 'Multi-site / integrador',
    price: 'Falar com vendas',
    priceNote: 'Contrato anual personalizado',
    cta: 'Falar com vendas',
    ctaHref:
      'mailto:suporte@hydrowave.com?subject=HydroWave%20Enterprise%20Estufa&body=Olá,%20tenho%20interesse%20no%20plano%20Enterprise%20para%20operação%20comercial.',
    ctaStyle: 'secondary' as const,
    highlighted: false,
    features: [
      'Multi-site e multi-usuário',
      'API e exportação de relatórios',
      'SLA de suporte 4h em horário comercial',
      'Onboarding presencial ou remoto dedicado',
      'Integração com operação existente',
    ],
  },
];

const ADDON_SERVICES = [
  {
    icon: WrenchScrewdriverIcon,
    title: 'Instalação e comissionamento remoto',
    description: 'Configuração WiFi, associação de conta e verificação de telemetria com especialista.',
  },
  {
    icon: SparklesIcon,
    title: 'Calibragem assistida (1 sessão)',
    description: 'Sessão guiada para calibrar bombas peristálticas e validar dosagem na proveta.',
  },
  {
    icon: AcademicCapIcon,
    title: 'Treinamento da equipe (2h online)',
    description: 'Capacitação em Auto EC, Auto pH, calibragem e boas práticas de cultivo hidropônico.',
  },
  {
    icon: SignalIcon,
    title: 'Monitoramento gerenciado 24/7',
    description: 'Add-on mensal com alertas proativos e acompanhamento da operação pelo time HydroWave.',
  },
];

const COMPARISON_ROWS = [
  { feature: 'Dispositivos', free: '1 master', premium: 'Conforme contrato', enterprise: 'Ilimitado*' },
  { feature: 'Histórico de dados', free: '30 dias', premium: '12 meses', enterprise: 'Ilimitado' },
  { feature: 'Auto EC / Auto pH', free: 'Sim', premium: 'Sim + prioridade', enterprise: 'Sim + SLA' },
  { feature: 'Alertas SMS', free: '—', premium: 'Sim', enterprise: 'Sim' },
  { feature: 'API / exportação', free: '—', premium: 'Básico', enterprise: 'Completo' },
  { feature: 'Suporte', free: 'Email 48h', premium: 'Estendido', enterprise: 'SLA 4h' },
];

function PlanBadge({ type }: { type: PlanId }) {
  const styles: Record<PlanId, string> = {
    free: 'bg-dark-surface text-dark-textSecondary border-dark-border',
    premium: 'bg-aqua-500/20 text-aqua-400 border-aqua-500/40',
    enterprise: 'bg-primary-500/20 text-primary-400 border-primary-500/40',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${styles[type]}`}
    >
      Plano atual: {PLAN_LABELS[type]}
    </span>
  );
}

export default function PlanosPage() {
  const { userProfile } = useAuth();
  const currentPlan = (userProfile?.subscription_type || 'free') as PlanId;

  return (
    <div className="min-h-screen bg-dark-bg">
      <header className="bg-dark-card border-b border-dark-border shadow-lg">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <BrandLogo variant="gradient" size={40} />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-aqua-400 to-primary-400 bg-clip-text text-transparent">
                  Planos e Serviços
                </h1>
                <p className="text-dark-textSecondary mt-1 text-sm max-w-xl">
                  Automação hidropônica para operações que não podem parar
                </p>
              </div>
            </div>
            <PlanBadge type={currentPlan} />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-12">
        <section>
          <h2 className="text-lg font-semibold text-dark-text mb-4">Planos comerciais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier) => {
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
                      Recomendado para produção
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
                      {isCurrent && tier.id === 'free' ? 'Plano ativo' : tier.cta}
                    </a>
                  ) : (
                    <Link
                      href={tier.ctaHref}
                      className="block text-center py-3 px-4 rounded-lg font-medium bg-dark-surface border border-dark-border text-dark-text hover:border-aqua-500/50 transition-all"
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-dark-text mb-2">Serviços adicionais</h2>
          <p className="text-sm text-dark-textSecondary mb-6">
            Contrate avulso ou como complemento do seu plano — modelo consultivo, sem checkout automático nesta fase.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ADDON_SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
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
              href="mailto:suporte@hydrowave.com?subject=Serviços%20adicionais%20HydroWave"
              className="inline-block bg-gradient-to-r from-aqua-500 to-primary-500 hover:from-aqua-600 hover:to-primary-600 text-white font-medium py-2 px-6 rounded-lg transition-all shadow-lg hover:shadow-aqua-500/50"
            >
              Solicitar orçamento de serviços
            </a>
          </div>
        </section>

        <section className="bg-dark-card border border-dark-border border-t-2 border-t-aqua-500 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-dark-text p-6 border-b border-dark-border">
            Comparativo de planos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-surface text-dark-textSecondary">
                  <th className="text-left p-4 font-medium">Recurso</th>
                  <th className="p-4 font-medium text-center">Operação Inicial</th>
                  <th className="p-4 font-medium text-center text-aqua-400">Pro Comercial</th>
                  <th className="p-4 font-medium text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
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
            * Limites de Enterprise definidos em contrato. Pagamento recorrente (cartão, Pix ou boleto) será
            disponibilizado em versão futura via portal de assinatura.
          </p>
        </section>

        <section className="text-center pb-8 space-y-3">
          <p className="text-dark-textSecondary text-sm">
            Dúvidas sobre qual plano escolher?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/informacao"
              className="text-aqua-400 hover:text-aqua-300 text-sm font-medium transition-colors"
            >
              Consultar manual de uso →
            </Link>
            <Link
              href="/quem-somos"
              className="text-aqua-400 hover:text-aqua-300 text-sm font-medium transition-colors"
            >
              Conheça a HydroWave →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
