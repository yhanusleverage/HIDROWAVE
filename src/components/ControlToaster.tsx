'use client';

import { Toaster } from 'react-hot-toast';

/** Toaster global — tema escuro industrial para toasts simples (toast.success/error legados). */
export default function ControlToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerStyle={{ top: 16, right: 16 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0f1e3a',
          color: '#e0f2fe',
          border: '1px solid #1e3a5f',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '13px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          maxWidth: '22rem',
        },
        success: {
          iconTheme: { primary: '#34d399', secondary: '#0f1e3a' },
          style: { borderLeft: '3px solid #34d399' },
        },
        error: {
          duration: 5000,
          iconTheme: { primary: '#f87171', secondary: '#0f1e3a' },
          style: { borderLeft: '3px solid #f87171' },
        },
        loading: {
          iconTheme: { primary: '#26c6da', secondary: '#0f1e3a' },
          style: { borderLeft: '3px solid #26c6da', fontFamily: 'ui-monospace, monospace' },
        },
      }}
    />
  );
}
