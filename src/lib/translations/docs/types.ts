import type { HwAccent } from '@/lib/design-tokens';

export type DocsSectionId = 'support' | 'processos';

export type SupportPageSlug =
  | 'hub'
  | 'arquitetura'
  | 'hidraulica'
  | 'regras'
  | 'controle'
  | 'sensores';

export type ProcessosPageSlug =
  | 'hub'
  | 'ciclos-automaticos'
  | 'scripts-sequenciais'
  | 'agendamentos';

export interface DocsNavItem {
  href: string;
  label: string;
}

export interface DocsCalloutContent {
  variant: 'info' | 'warning' | 'tip';
  title: string;
  body: string;
}

export interface DocsStepContent {
  title: string;
  body: string;
}

export interface DocsLayerContent {
  title: string;
  body: string;
  accent: HwAccent;
}

export interface DocsCardContent {
  href: string;
  title: string;
  description: string;
  accent: HwAccent;
}

export interface DocsTableRow {
  cells: string[];
}

export interface DocsImageContent {
  src: string;
  alt: string;
  caption?: string;
}

export interface DocsPriorityRowContent {
  priority: number;
  label: string;
  accent: HwAccent;
  body: string;
  examples?: string[];
}

export interface DocsSubsectionContent {
  title: string;
  body?: string;
  bullets?: string[];
  steps?: DocsStepContent[];
}

export interface DocsSensorCardContent {
  badge: string; // ej. "pH", "EC", "°C", "Nível"
  title: string;
  accent: HwAccent;
  intro?: string;
  image?: DocsImageContent;
  subsections: DocsSubsectionContent[];
}

export interface DocsSectionContent {
  id: string;
  title: string;
  subtitle?: string;
  accent?: HwAccent;
  paragraphs?: string[];
  bullets?: string[];
  steps?: DocsStepContent[];
  code?: string;
  callouts?: DocsCalloutContent[];
  table?: {
    headers: string[];
    rows: DocsTableRow[];
  };
  layers?: DocsLayerContent[];
  stateFlow?: string[];
  image?: DocsImageContent;
  priorityStack?: DocsPriorityRowContent[];
  sensorCards?: DocsSensorCardContent[];
}

export interface DocsPageContent {
  slug: string;
  title: string;
  subtitle: string;
  breadcrumb: string;
  sections: DocsSectionContent[];
  cards?: DocsCardContent[];
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
  help?: {
    title: string;
    body: string;
    emailLabel: string;
    email: string;
    plansLabel: string;
    plansHref: string;
  };
}

export interface DocsNavTree {
  sectionTitle: string;
  hubHref: string;
  hubLabel: string;
  items: DocsNavItem[];
  otherSection?: {
    title: string;
    hubHref: string;
    hubLabel: string;
    items: DocsNavItem[];
  };
}

export interface DocsShellLabels {
  onThisPage: string;
  collapseNav: string;
  expandNav: string;
}
