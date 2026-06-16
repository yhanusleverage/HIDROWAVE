'use client';

import { useEffect } from 'react';
import BrandLoading from '@/components/BrandLoading';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module')
  );
}

export default function AutomacaoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[automacao] route error:', error);
    if (isChunkLoadError(error)) {
      const key = 'hw-automacao-chunk-retry';
      const retries = Number(sessionStorage.getItem(key) || '0');
      if (retries < 2) {
        sessionStorage.setItem(key, String(retries + 1));
        window.location.reload();
      }
    }
  }, [error]);

  const chunkError = isChunkLoadError(error);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 text-center">
      <h2 className="text-xl font-semibold text-dark-text mb-2">
        {chunkError ? 'Falha ao carregar o módulo de automação' : 'Erro na página de automação'}
      </h2>
      <p className="text-sm text-dark-textSecondary max-w-md mb-6">
        {chunkError
          ? 'O bundle da página demorou demais (comum em dev após alterações). Recarregue ou reinicie npm run dev.'
          : error.message || 'Ocorreu um erro inesperado.'}
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('hw-automacao-chunk-retry');
            reset();
          }}
          className="px-4 py-2 rounded-lg bg-aqua-500 hover:bg-aqua-600 text-white text-sm font-medium transition-colors"
        >
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('hw-automacao-chunk-retry');
            window.location.reload();
          }}
          className="px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-dark-text text-sm hover:bg-dark-card transition-colors"
        >
          Recarregar página
        </button>
      </div>
      {chunkError && (
        <div className="mt-8 opacity-60">
          <BrandLoading layout="inline" message="Se persistir: pare o dev server, apague .next e rode npm run dev" />
        </div>
      )}
    </div>
  );
}
