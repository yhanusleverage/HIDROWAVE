'use client';

import { Toaster } from 'react-hot-toast';

/** Toaster global — usa variáveis CSS do tema HydroWave. */
export default function ControlToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerStyle={{ top: 16, right: 16 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--hw-surface-1)',
          color: 'var(--foreground)',
          border: '1px solid #1e3a5f',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '13px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          maxWidth: '22rem',
        },
        success: {
          iconTheme: { primary: 'var(--hw-domain-ec)', secondary: 'var(--hw-surface-1)' },
          style: { borderLeft: '3px solid var(--hw-domain-ec)' },
        },
        error: {
          duration: 5000,
          iconTheme: { primary: 'var(--hw-intent-danger)', secondary: 'var(--hw-surface-1)' },
          style: { borderLeft: '3px solid var(--hw-intent-danger)' },
        },
        loading: {
          iconTheme: { primary: 'var(--hw-domain-brand)', secondary: 'var(--hw-surface-1)' },
          style: { borderLeft: '3px solid var(--hw-domain-brand)', fontFamily: 'ui-monospace, monospace' },
        },
      }}
    />
  );
}
