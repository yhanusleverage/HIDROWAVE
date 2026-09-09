export type PlanId = 'free' | 'premium' | 'enterprise';

export interface PlanosTier {
  id: PlanId;
  name: string;
  audience: string;
  price: string;
  priceNote: string;
  cta: string;
  ctaHref: string;
  ctaStyle: 'primary' | 'secondary';
  highlighted: boolean;
  features: string[];
}

export type PlanosAddonId =
  | 'install'
  | 'calibration'
  | 'training'
  | 'monitoring';

export interface PlanosAddon {
  id: PlanosAddonId;
  title: string;
  description: string;
}

export interface PlanosComparisonRow {
  feature: string;
  free: string;
  premium: string;
  enterprise: string;
}

export interface PlanosCopy {
  header: {
    title: string;
    subtitle: string;
  };
  currentPlanPrefix: string;
  recommendedBadge: string;
  planActiveCta: string;
  tiersTitle: string;
  tiers: PlanosTier[];
  addons: {
    title: string;
    subtitle: string;
    services: PlanosAddon[];
    requestQuote: string;
    requestQuoteHref: string;
  };
  comparison: {
    title: string;
    featureColumn: string;
    columnFree: string;
    columnPremium: string;
    columnEnterprise: string;
    rows: PlanosComparisonRow[];
    footnote: string;
  };
  footer: {
    question: string;
    manualCta: string;
    aboutCta: string;
  };
}
