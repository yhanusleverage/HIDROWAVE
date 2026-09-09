export type InformacaoQuickLinkId = 'automacao' | 'calibragem' | 'fundamentos';

export type AutoEcFaqStep = {
  text: string;
  link?: { href: string; label: string };
  textAfter?: string;
};

export type InformacaoFaqItem =
  | { question: string; answer: string }
  | { question: string; answerKind: 'autoEc'; steps: AutoEcFaqStep[] };

export interface InformacaoCopy {
  header: {
    title: string;
    subtitle: string;
  };
  quickLinks: Array<{
    id: InformacaoQuickLinkId;
    href: string;
    title: string;
    description: string;
  }>;
  technicalDocs: {
    title: string;
    body: string;
    supportCta: string;
    processosCta: string;
  };
  fluxo: {
    title: string;
    steps: Array<{ title: string; body: string }>;
  };
  faq: {
    title: string;
    items: InformacaoFaqItem[];
  };
  guides: {
    title: string;
    items: Array<{ title: string; body: string }>;
  };
  support: {
    title: string;
    intro: string;
    email: string;
    chat: string;
    plansCta: string;
  };
}
