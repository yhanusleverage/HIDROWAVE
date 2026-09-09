import type { PlanosCopy } from './types';

export const planosEn: PlanosCopy = {
  header: {
    title: 'Plans and Services',
    subtitle:
      'Core fleet in the cloud with the kit. Subscription = retention, alerts, and support — not the right to see a second device.',
  },
  currentPlanPrefix: 'Current plan:',
  recommendedBadge: 'Recommended for production',
  planActiveCta: 'Active plan',
  tiersTitle: 'Commercial plans',
  tiers: [
    {
      id: 'free',
      name: 'Starter Operation',
      audience: 'Kit + cloud — as many Cores as you buy',
      price: 'Included with kit purchase',
      priceNote: 'N devices and multi-site on the same dashboard — no artificial ceiling',
      cta: 'I’m already using it',
      ctaHref: '/dashboard',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'N HydroWave Core + Atlas on the same dashboard (multi-site)',
        'Auto EC and Auto pH + circulation pump typing',
        'Sensor history: 30 days',
        'Email support (reply within 48h)',
      ],
    },
    {
      id: 'premium',
      name: 'Commercial Pro',
      audience: 'Operations that need retention and alerts',
      price: 'On request',
      priceNote: 'From R$ 299/month per account — not per Core',
      cta: 'Request Pro upgrade',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=Upgrade%20HydroWave%20Pro%20Comercial&body=Olá,%20gostaria%20de%20informações%20sobre%20o%20plano%20Pro%20Comercial.',
      ctaStyle: 'primary',
      highlighted: true,
      features: [
        'Everything in Starter (fleet included)',
        'Full history: 12 months',
        'Priority SMS and email alerts',
        'Remote assisted pump calibration',
        'Commercial support with extended hours',
      ],
    },
    {
      id: 'enterprise',
      name: 'Greenhouse Enterprise',
      audience: 'Integrator / operation with SLA and API',
      price: 'Talk to sales',
      priceNote: 'Custom annual contract',
      cta: 'Talk to sales',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=HydroWave%20Enterprise%20Estufa&body=Olá,%20tenho%20interesse%20no%20plano%20Enterprise%20para%20operação%20comercial.',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'Everything in Pro + advanced multi-user',
        'API and report export',
        '4h support SLA during business hours',
        'Dedicated on-site or remote onboarding',
        'Integration with existing operations',
      ],
    },
  ],
  addons: {
    title: 'Add-on services',
    subtitle:
      'Hire à la carte or as a complement to your plan — consultative model, no automatic checkout at this stage.',
    services: [
      {
        id: 'install',
        title: 'Remote installation and commissioning',
        description:
          'Wi‑Fi setup, account linking, and telemetry verification with a specialist.',
      },
      {
        id: 'calibration',
        title: 'Assisted calibration (1 session)',
        description:
          'Guided session to calibrate peristaltic pumps and validate dosing with a graduated cylinder.',
      },
      {
        id: 'training',
        title: 'Team training (2h online)',
        description:
          'Training on Auto EC, Auto pH, calibration, and hydroponic best practices.',
      },
      {
        id: 'monitoring',
        title: 'Managed monitoring 24/7',
        description:
          'Monthly add-on with proactive alerts and operation follow-up by the HydroWave team.',
      },
    ],
    requestQuote: 'Request a services quote',
    requestQuoteHref: 'mailto:suporte@hydrowave.com?subject=Serviços%20adicionais%20HydroWave',
  },
  comparison: {
    title: 'Plan comparison',
    featureColumn: 'Feature',
    columnFree: 'Starter Operation',
    columnPremium: 'Commercial Pro',
    columnEnterprise: 'Enterprise',
    rows: [
      {
        feature: 'Devices / multi-site',
        free: 'N Cores (kit)',
        premium: 'Included',
        enterprise: 'Included',
      },
      {
        feature: 'Data history',
        free: '30 days',
        premium: '12 months',
        enterprise: 'Unlimited*',
      },
      {
        feature: 'Auto EC / Auto pH + circulation',
        free: 'Yes',
        premium: 'Yes',
        enterprise: 'Yes + SLA',
      },
      { feature: 'SMS alerts', free: '—', premium: 'Yes', enterprise: 'Yes' },
      {
        feature: 'API / export',
        free: '—',
        premium: 'Basic',
        enterprise: 'Full',
      },
      {
        feature: 'Support',
        free: 'Email 48h',
        premium: 'Extended',
        enterprise: 'SLA 4h',
      },
    ],
    footnote:
      '* Enterprise retention and SLA are defined in the contract. Core count follows purchased hardware on all plans. Recurring payment (card, Pix, or boleto) will be available in a future release via the subscription portal.',
  },
  footer: {
    question: 'Not sure which plan to choose?',
    manualCta: 'Open the user manual →',
    aboutCta: 'Meet HydroWave →',
  },
};
