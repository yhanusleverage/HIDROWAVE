'use client';

import BrandLoading from '@/components/BrandLoading';

/** Overlay full-screen com σ pulsante durante transição entre páginas. */
export default function PageNavOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-dark-bg/85 backdrop-blur-[4px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="A navegar entre páginas"
    >
      <BrandLoading layout="hero" variant="gradient" size={80} showWordmark />
    </div>
  );
}
