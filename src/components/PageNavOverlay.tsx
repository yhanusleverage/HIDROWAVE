'use client';

import TranslatedBrandLoading from '@/components/TranslatedBrandLoading';

/** Overlay full-screen com σ pulsante durante transição entre páginas. */
export default function PageNavOverlay() {
  return (
    <TranslatedBrandLoading
      layout="hero"
      size={120}
      showWordmark
      messageKey="loading"
    />
  );
}
