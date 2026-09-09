import type { PlanosCopy } from './types';

export const planosPt: PlanosCopy = {
  header: {
    title: 'Planos e Serviços',
    subtitle:
      'Flota de Cores no cloud com o kit. Assinatura = retenção, alertas e suporte — não o direito de ver o segundo device.',
  },
  currentPlanPrefix: 'Plano atual:',
  recommendedBadge: 'Recomendado para produção',
  planActiveCta: 'Plano ativo',
  tiersTitle: 'Planos comerciais',
  tiers: [
    {
      id: 'free',
      name: 'Operação Inicial',
      audience: 'Kit + cloud — quantos Cores você comprar',
      price: 'Incluído na compra do kit',
      priceNote: 'N devices e multi-site no mesmo dashboard — sem teto artificial',
      cta: 'Já estou usando',
      ctaHref: '/dashboard',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'N HydroWave Core + Atlas no mesmo dashboard (multi-site)',
        'Auto EC e Auto pH + tipagem da bomba de circulação',
        'Histórico de sensores: 30 dias',
        'Suporte por email (resposta em até 48h)',
      ],
    },
    {
      id: 'premium',
      name: 'Pro Comercial',
      audience: 'Operação que precisa de retenção e alertas',
      price: 'Sob consulta',
      priceNote: 'A partir de R$ 299/mês por conta — não por Core',
      cta: 'Solicitar upgrade Pro',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=Upgrade%20HydroWave%20Pro%20Comercial&body=Olá,%20gostaria%20de%20informações%20sobre%20o%20plano%20Pro%20Comercial.',
      ctaStyle: 'primary',
      highlighted: true,
      features: [
        'Tudo do plano Inicial (flota incluída)',
        'Histórico completo: 12 meses',
        'Alertas SMS e email prioritários',
        'Calibragem de bombas assistida remotamente',
        'Suporte comercial em horário estendido',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise Estufa',
      audience: 'Integrador / operação com SLA e API',
      price: 'Falar com vendas',
      priceNote: 'Contrato anual personalizado',
      cta: 'Falar com vendas',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=HydroWave%20Enterprise%20Estufa&body=Olá,%20tenho%20interesse%20no%20plano%20Enterprise%20para%20operação%20comercial.',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'Tudo do Pro + multi-usuário avançado',
        'API e exportação de relatórios',
        'SLA de suporte 4h em horário comercial',
        'Onboarding presencial ou remoto dedicado',
        'Integração com operação existente',
      ],
    },
  ],
  addons: {
    title: 'Serviços adicionais',
    subtitle:
      'Contrate avulso ou como complemento do seu plano — modelo consultivo, sem checkout automático nesta fase.',
    services: [
      {
        id: 'install',
        title: 'Instalação e comissionamento remoto',
        description:
          'Configuração WiFi, associação de conta e verificação de telemetria com especialista.',
      },
      {
        id: 'calibration',
        title: 'Calibragem assistida (1 sessão)',
        description:
          'Sessão guiada para calibrar bombas peristálticas e validar dosagem na proveta.',
      },
      {
        id: 'training',
        title: 'Treinamento da equipe (2h online)',
        description:
          'Capacitação em Auto EC, Auto pH, calibragem e boas práticas de cultivo hidropônico.',
      },
      {
        id: 'monitoring',
        title: 'Monitoramento gerenciado 24/7',
        description:
          'Add-on mensal com alertas proativos e acompanhamento da operação pelo time HydroWave.',
      },
    ],
    requestQuote: 'Solicitar orçamento de serviços',
    requestQuoteHref: 'mailto:suporte@hydrowave.com?subject=Serviços%20adicionais%20HydroWave',
  },
  comparison: {
    title: 'Comparativo de planos',
    featureColumn: 'Recurso',
    columnFree: 'Operação Inicial',
    columnPremium: 'Pro Comercial',
    columnEnterprise: 'Enterprise',
    rows: [
      {
        feature: 'Dispositivos / multi-site',
        free: 'N Cores (kit)',
        premium: 'Incluído',
        enterprise: 'Incluído',
      },
      {
        feature: 'Histórico de dados',
        free: '30 dias',
        premium: '12 meses',
        enterprise: 'Ilimitado*',
      },
      {
        feature: 'Auto EC / Auto pH + circulação',
        free: 'Sim',
        premium: 'Sim',
        enterprise: 'Sim + SLA',
      },
      { feature: 'Alertas SMS', free: '—', premium: 'Sim', enterprise: 'Sim' },
      {
        feature: 'API / exportação',
        free: '—',
        premium: 'Básico',
        enterprise: 'Completo',
      },
      {
        feature: 'Suporte',
        free: 'Email 48h',
        premium: 'Estendido',
        enterprise: 'SLA 4h',
      },
    ],
    footnote:
      '* Retenção Enterprise e SLA definidos em contrato. Quantidade de Cores acompanha o hardware comprado em todos os planos. Pagamento recorrente (cartão, Pix ou boleto) será disponibilizado em versão futura via portal de assinatura.',
  },
  footer: {
    question: 'Dúvidas sobre qual plano escolher?',
    manualCta: 'Consultar manual de uso →',
    aboutCta: 'Conheça a HydroWave →',
  },
};
