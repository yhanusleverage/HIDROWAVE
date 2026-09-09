import type { PlanosCopy } from './types';

export const planosEs: PlanosCopy = {
  header: {
    title: 'Planes y Servicios',
    subtitle:
      'Flota de Cores en la nube con el kit. Suscripción = retención, alertas y soporte — no el derecho a ver el segundo device.',
  },
  currentPlanPrefix: 'Plan actual:',
  recommendedBadge: 'Recomendado para producción',
  planActiveCta: 'Plan activo',
  tiersTitle: 'Planes comerciales',
  tiers: [
    {
      id: 'free',
      name: 'Operación Inicial',
      audience: 'Kit + cloud — tantos Cores como compres',
      price: 'Incluido en la compra del kit',
      priceNote: 'N devices y multi-site en el mismo dashboard — sin techo artificial',
      cta: 'Ya lo estoy usando',
      ctaHref: '/dashboard',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'N HydroWave Core + Atlas en el mismo dashboard (multi-site)',
        'Auto EC y Auto pH + tipado de la bomba de circulación',
        'Historial de sensores: 30 días',
        'Soporte por email (respuesta en hasta 48h)',
      ],
    },
    {
      id: 'premium',
      name: 'Pro Comercial',
      audience: 'Operación que necesita retención y alertas',
      price: 'Bajo consulta',
      priceNote: 'Desde R$ 299/mes por cuenta — no por Core',
      cta: 'Solicitar upgrade Pro',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=Upgrade%20HydroWave%20Pro%20Comercial&body=Olá,%20gostaria%20de%20informações%20sobre%20o%20plano%20Pro%20Comercial.',
      ctaStyle: 'primary',
      highlighted: true,
      features: [
        'Todo del plan Inicial (flota incluida)',
        'Historial completo: 12 meses',
        'Alertas SMS y email prioritarios',
        'Calibración de bombas asistida de forma remota',
        'Soporte comercial en horario extendido',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise Invernadero',
      audience: 'Integrador / operación con SLA y API',
      price: 'Hablar con ventas',
      priceNote: 'Contrato anual personalizado',
      cta: 'Hablar con ventas',
      ctaHref:
        'mailto:suporte@hydrowave.com?subject=HydroWave%20Enterprise%20Estufa&body=Olá,%20tenho%20interesse%20no%20plano%20Enterprise%20para%20operação%20comercial.',
      ctaStyle: 'secondary',
      highlighted: false,
      features: [
        'Todo del Pro + multi-usuario avanzado',
        'API y exportación de informes',
        'SLA de soporte 4h en horario comercial',
        'Onboarding presencial o remoto dedicado',
        'Integración con la operación existente',
      ],
    },
  ],
  addons: {
    title: 'Servicios adicionales',
    subtitle:
      'Contrate por separado o como complemento de su plan — modelo consultivo, sin checkout automático en esta fase.',
    services: [
      {
        id: 'install',
        title: 'Instalación y puesta en marcha remota',
        description:
          'Configuración Wi‑Fi, asociación de cuenta y verificación de telemetría con un especialista.',
      },
      {
        id: 'calibration',
        title: 'Calibración asistida (1 sesión)',
        description:
          'Sesión guiada para calibrar bombas peristálticas y validar la dosificación en probeta.',
      },
      {
        id: 'training',
        title: 'Capacitación del equipo (2h online)',
        description:
          'Formación en Auto EC, Auto pH, calibración y buenas prácticas de cultivo hidropónico.',
      },
      {
        id: 'monitoring',
        title: 'Monitoreo gestionado 24/7',
        description:
          'Add-on mensual con alertas proactivas y seguimiento de la operación por el equipo HydroWave.',
      },
    ],
    requestQuote: 'Solicitar presupuesto de servicios',
    requestQuoteHref: 'mailto:suporte@hydrowave.com?subject=Serviços%20adicionais%20HydroWave',
  },
  comparison: {
    title: 'Comparativa de planes',
    featureColumn: 'Recurso',
    columnFree: 'Operación Inicial',
    columnPremium: 'Pro Comercial',
    columnEnterprise: 'Enterprise',
    rows: [
      {
        feature: 'Dispositivos / multi-site',
        free: 'N Cores (kit)',
        premium: 'Incluido',
        enterprise: 'Incluido',
      },
      {
        feature: 'Historial de datos',
        free: '30 días',
        premium: '12 meses',
        enterprise: 'Ilimitado*',
      },
      {
        feature: 'Auto EC / Auto pH + circulación',
        free: 'Sí',
        premium: 'Sí',
        enterprise: 'Sí + SLA',
      },
      { feature: 'Alertas SMS', free: '—', premium: 'Sí', enterprise: 'Sí' },
      {
        feature: 'API / exportación',
        free: '—',
        premium: 'Básico',
        enterprise: 'Completo',
      },
      {
        feature: 'Soporte',
        free: 'Email 48h',
        premium: 'Extendido',
        enterprise: 'SLA 4h',
      },
    ],
    footnote:
      '* Retención Enterprise y SLA definidos en contrato. La cantidad de Cores sigue el hardware comprado en todos los planes. El pago recurrente (tarjeta, Pix o boleto) estará disponible en una versión futura vía el portal de suscripción.',
  },
  footer: {
    question: '¿Dudas sobre qué plan elegir?',
    manualCta: 'Consultar el manual de uso →',
    aboutCta: 'Conozca HydroWave →',
  },
};
