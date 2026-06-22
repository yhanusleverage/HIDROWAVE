import type { HwAccent } from '@/lib/design-tokens';

export type QuemSomosIconId =
  | 'electronics'
  | 'hydraulics'
  | 'chemistry'
  | 'nutrition'
  | 'environment'
  | 'telemetry'
  | 'connectivity';

export interface QuemSomosElement {
  id: QuemSomosIconId;
  element: string;
  title: string;
  subtitle: string;
  technicalDetail: string;
  plain: string;
  tagline: string;
  href: string;
  ctaLabel: string;
  accent: HwAccent;
}

export interface QuemSomosJourneyStep {
  step: string;
  layer: string;
  detail: string;
}

export interface QuemSomosSocialProof {
  title: string;
  description: string;
  highlight: string;
  href: string;
  ctaLabel: string;
  accent: HwAccent;
}

export interface QuemSomosBeforeAfterRow {
  without: string;
  with: string;
}

export const QUEM_SOMOS_HERO = {
  eyebrow: 'Quem somos',
  title: 'Domine os',
  titleHighlight: 'elementos da hidroponia',
  subtitle:
    'pH, EC, temperatura, nível e fluxo são forças silenciosas que decidem sua colheita. O HydroWave nasceu para colocar cada uma delas nas suas mãos — com a clareza de quem precisa colher amanhã, não depois de um doutorado.',
};

export const QUEM_SOMOS_MISSION = {
  title: 'Nossa missão, em uma frase',
  body:
    'Controlar as nuances das grandezas que governam a hidroponia — concentração nutritiva (EC), acidez (pH), temperatura, volume e tempo — e entregá-las a você como ferramentas de trabalho, não como enigmas de laboratório.',
  aside:
    'Pensamos na hidroponia como um sistema de elementos: eletrônica que sente, hidráulica que move, química que equilibra, nutrição que alimenta, ambiente que monitora, telemetria que revela e conectividade que une tudo.',
};

export const QUEM_SOMOS_ELEMENTS: QuemSomosElement[] = [
  {
    id: 'electronics',
    element: 'Eletrônica',
    title: 'O Nervo do Sistema',
    subtitle: 'Controlador · sensores · bombas · relés',
    technicalDetail: 'ESP32 · GPIO · peristálticas · matriz de relés',
    plain:
      'Construímos o hardware que mede, decide e age no reservatório — sem depender de você ficar olhando o tanque o dia inteiro.',
    tagline: 'Cada pulso, cada leitura, cada relé — precisão no campo.',
    href: '/dispositivos',
    ctaLabel: 'Ver dispositivos',
    accent: 'warn',
  },
  {
    id: 'hydraulics',
    element: 'Hidráulica',
    title: 'Domínio das Águas',
    subtitle: 'Nível · recirculação · solução nutritiva',
    technicalDetail: 'Sensor ultrassônico · tempo de recirculação · volume do reservatório',
    plain:
      'Monitoramos o que entra, o que sai e o que a planta consome — porque hidroponia é equilíbrio líquido, não sorte.',
    tagline: 'Volume, fluxo e mistura sob controle.',
    href: '/dispositivos',
    ctaLabel: 'Ver dispositivos',
    accent: 'wait',
  },
  {
    id: 'chemistry',
    element: 'Química',
    title: 'Equilíbrio Ácido-Base',
    subtitle: 'Auto pH · calibragem · banda morta',
    technicalDetail: 'AdaptivePHController · domínio H⁺ · max_dose_ml_per_cycle',
    plain:
      'Pequenas variações de acidez mudam tudo. O sistema corrige dentro da tolerância que você define — claro, previsível, seguro.',
    tagline: 'pH estável é colheita previsível.',
    href: '/automacao',
    ctaLabel: 'Configurar Auto pH',
    accent: 'ph',
  },
  {
    id: 'nutrition',
    element: 'Nutrição',
    title: 'Força da Solução',
    subtitle: 'Auto EC · plano nutricional · dose proporcional',
    technicalDetail: 'Setpoint EC · banda morta · dosagem sequencial por nutriente',
    plain:
      'EC é a força nutritiva da sua cultura. Calculamos a dose certa, respeitamos a banda morta e só agimos quando faz sentido.',
    tagline: 'Nutrientes na medida — nem falta, nem excesso.',
    href: '/automacao',
    ctaLabel: 'Configurar Auto EC',
    accent: 'ec',
  },
  {
    id: 'environment',
    element: 'Ambiente',
    title: 'Clima da Solução',
    subtitle: 'Temperatura da água · alertas · tendências',
    technicalDetail: 'Sonda DS18B20 · histórico no dashboard · umbrais configuráveis',
    plain:
      'A temperatura muda a oxigenação e a absorção de nutrientes. Acompanhamos a água e avisamos quando sair da faixa ideal — sem prometer controle climático que ainda não existe.',
    tagline: 'Monitorar antes de corrigir no escuro.',
    href: '/dashboard',
    ctaLabel: 'Ver temperatura',
    accent: 'ok',
  },
  {
    id: 'telemetry',
    element: 'Telemetria',
    title: 'Visão em Tempo Real',
    subtitle: 'Dashboard · gráficos · status dos ciclos',
    technicalDetail: 'Supabase Realtime · gráfico hidro combinado · cards de sensores',
    plain:
      'Tudo o que acontece no campo chega ao seu painel: pH, EC, temperatura e status dos ciclos — num só lugar.',
    tagline: 'Decisão com dados, não com achismo.',
    href: '/dashboard',
    ctaLabel: 'Abrir dashboard',
    accent: 'brand',
  },
  {
    id: 'connectivity',
    element: 'Conectividade',
    title: 'Ponte Campo-Nuvem',
    subtitle: 'Wi‑Fi · nuvem · alertas no celular',
    technicalDetail: 'MQTT · bridge · telemetria contínua · status online',
    plain:
      'O equipamento fala com a nuvem em tempo real. Você sabe se está online antes que um problema vire prejuízo.',
    tagline: 'O tanque nunca fica sozinho.',
    href: '/informacao',
    ctaLabel: 'Manual de uso',
    accent: 'brand',
  },
];

export const QUEM_SOMOS_SOCIAL_PROOF: QuemSomosSocialProof[] = [
  {
    title: 'Piloto validado',
    description:
      'Auto EC em loop fechado, telemetria em tempo real e calibragem assistida — testado em bancada antes de ir para a estufa.',
    highlight: 'Do sensor à dose confirmada',
    href: '/informacao',
    ctaLabel: 'Ver fluxo recomendado',
    accent: 'ok',
  },
  {
    title: 'Operação comercial',
    description:
      'Planos Pro e Enterprise para estufas em produção: histórico estendido, alertas prioritários e suporte dedicado.',
    highlight: 'Escala com a sua operação',
    href: '/planos',
    ctaLabel: 'Ver planos',
    accent: 'brand',
  },
  {
    title: 'Transparência',
    description:
      'Banda morta, limite de dose por ciclo e calibragem antes de confiar no automático — sem surpresas no tanque.',
    highlight: 'Automação com limites claros',
    href: '/fundamentos',
    ctaLabel: 'Fundamentos de cultivo',
    accent: 'ph',
  },
];

export const QUEM_SOMOS_BEFORE_AFTER: QuemSomosBeforeAfterRow[] = [
  {
    without: 'Medir pH na mão e corrigir no feeling',
    with: 'Auto pH com tolerância e limite de dose por ciclo',
  },
  {
    without: 'EC oscilando entre visitas ao tanque',
    with: 'Auto EC proporcional + gráfico no dashboard',
  },
  {
    without: 'Não saber se o equipamento está online',
    with: 'Status do dispositivo + alertas em tempo real',
  },
  {
    without: 'Dosar nutrientes sem saber se a bomba está calibrada',
    with: 'Calibragem de bombas e validação antes de ativar o automático',
  },
];

export const QUEM_SOMOS_JOURNEY: QuemSomosJourneyStep[] = [
  {
    step: '01',
    layer: 'Campo',
    detail: 'Sensores de pH, EC e nível. Bombas peristálticas calibradas. Relés mapeados por função.',
  },
  {
    step: '02',
    layer: 'Controlador',
    detail: 'Firmware que lê, compara com setpoint, respeita tolerância e dosifica com lógica de ciclo.',
  },
  {
    step: '03',
    layer: 'Nuvem',
    detail: 'Telemetria segura, histórico e comandos remotos — sua estufa conectada ao mundo.',
  },
  {
    step: '04',
    layer: 'Você',
    detail: 'Dashboard intuitivo, Auto EC, Auto pH, calibragem e regras — controle de alto nível, linguagem simples.',
  },
];

export const QUEM_SOMOS_PROMISES = [
  'Sem jargão desnecessário: explicamos o que importa para a sua colheita.',
  'Automação que respeita limites — banda morta, intervalos e calibragem antes de confiar.',
  'Do kit piloto à operação comercial: escalamos com você, não contra você.',
  'Feito por quem vive hidroponia de verdade, não só slides de marketing.',
];

export const QUEM_SOMOS_CTA = {
  title: 'Sua estufa merece controle de alto nível',
  subtitle:
    'Os instrumentos já estão prontos. Comece pelo dashboard ou fale conosco sobre operação comercial.',
};

export const QUEM_SOMOS_TEASER = {
  title: 'Conheça os elementos do HydroWave',
  subtitle: 'Do sensor no tanque ao gráfico no celular — veja como cada grandeza ganha um instrumento.',
  cta: 'Quem somos',
};
