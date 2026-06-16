import type { DocsShellLabels } from '../docs/types';

export const docsShellLabelsPt: DocsShellLabels = {
  onThisPage: 'Nesta página',
  collapseNav: 'Fechar menu',
  expandNav: 'Menu docs',
};

export const docsShellLabelsEn: DocsShellLabels = {
  onThisPage: 'On this page',
  collapseNav: 'Close menu',
  expandNav: 'Docs menu',
};

export const docsShellLabelsEs: DocsShellLabels = {
  onThisPage: 'En esta página',
  collapseNav: 'Cerrar menú',
  expandNav: 'Menú docs',
};

export function getDocsShellLabels(language: string): DocsShellLabels {
  if (language === 'en') return docsShellLabelsEn;
  if (language === 'es') return docsShellLabelsEs;
  return docsShellLabelsPt;
}
