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

export interface QuemSomosUi {
  howItWorks: string;
  promisesTitle: string;
  trustTitle: string;
  trustSubtitle: string;
  beforeAfterTitle: string;
  beforeAfterSubtitle: string;
  withoutHw: string;
  withHw: string;
  elementsTitle: string;
  elementsSubtitle: string;
  journeyTitle: string;
  journeySubtitle: string;
  ctaDashboard: string;
  ctaPlans: string;
  ctaManual: string;
  footer: string;
}

export interface QuemSomosCopy {
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
  };
  mission: {
    title: string;
    body: string;
    aside: string;
  };
  manifesto: {
    eyebrow: string;
    lead: string;
    subtitle: string;
    paragraphs: string[];
  };
  elements: QuemSomosElement[];
  socialProof: QuemSomosSocialProof[];
  beforeAfter: QuemSomosBeforeAfterRow[];
  productLine: {
    title: string;
    subtitle: string;
    modules: {
      name: string;
      role: string;
      body: string;
      accent: HwAccent;
    }[];
  };
  journey: QuemSomosJourneyStep[];
  promises: string[];
  cta: {
    title: string;
    subtitle: string;
  };
  teaser: {
    title: string;
    subtitle: string;
    cta: string;
  };
  ui: QuemSomosUi;
}
