export { getQuemSomosContent } from '@/lib/translations/quem-somos';
export type {
  QuemSomosCopy,
  QuemSomosIconId,
  QuemSomosElement,
  QuemSomosJourneyStep,
  QuemSomosSocialProof,
  QuemSomosBeforeAfterRow,
} from '@/lib/translations/quem-somos';

import { quemSomosPt } from '@/lib/translations/quem-somos/pt-BR';

/** @deprecated Prefer getQuemSomosContent(language).hero */
export const QUEM_SOMOS_HERO = quemSomosPt.hero;
/** @deprecated Prefer getQuemSomosContent(language).mission */
export const QUEM_SOMOS_MISSION = quemSomosPt.mission;
/** @deprecated Prefer getQuemSomosContent(language).manifesto */
export const QUEM_SOMOS_MANIFESTO = quemSomosPt.manifesto;
/** @deprecated Prefer getQuemSomosContent(language).elements */
export const QUEM_SOMOS_ELEMENTS = quemSomosPt.elements;
/** @deprecated Prefer getQuemSomosContent(language).socialProof */
export const QUEM_SOMOS_SOCIAL_PROOF = quemSomosPt.socialProof;
/** @deprecated Prefer getQuemSomosContent(language).beforeAfter */
export const QUEM_SOMOS_BEFORE_AFTER = quemSomosPt.beforeAfter;
/** @deprecated Prefer getQuemSomosContent(language).productLine */
export const QUEM_SOMOS_PRODUCT_LINE = quemSomosPt.productLine;
/** @deprecated Prefer getQuemSomosContent(language).journey */
export const QUEM_SOMOS_JOURNEY = quemSomosPt.journey;
/** @deprecated Prefer getQuemSomosContent(language).promises */
export const QUEM_SOMOS_PROMISES = quemSomosPt.promises;
/** @deprecated Prefer getQuemSomosContent(language).cta */
export const QUEM_SOMOS_CTA = quemSomosPt.cta;
/** @deprecated Prefer getQuemSomosContent(language).teaser */
export const QUEM_SOMOS_TEASER = quemSomosPt.teaser;
