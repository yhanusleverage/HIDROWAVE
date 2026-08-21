'use client';

import BrandLoading from '@/components/BrandLoading';

/** Overlay full-screen com σ pulsante durante transição entre páginas. */
export default function PageNavOverlay() {
  return (
    <BrandLoading
      layout="hero"
      variant="gradient"
      size={120}
      showWordmark
      message="Carregando..."
    />
  );
}
