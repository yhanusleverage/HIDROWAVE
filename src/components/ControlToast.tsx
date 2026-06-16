'use client';

import React from 'react';
import toast, { type Toast } from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { HW_BADGE, HW_TEXT, HW_TOAST_CATEGORY_ACCENT } from '@/lib/design-tokens';

export type ControlToastVariant = 'success' | 'error' | 'warning' | 'info';

export type ControlToastCategory =
  | 'SISTEMA'
  | 'RELÉ'
  | 'AUTO EC'
  | 'AUTO PH'
  | 'REGRA'
  | 'DISPOSITIVO'
  | 'CALIBRAGEM'
  | 'ALERTA';

const VARIANT_STYLES: Record<
  ControlToastVariant,
  { border: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    border: 'border-l-emerald-500',
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    icon: CheckCircleIcon,
  },
  error: {
    border: 'border-l-red-500',
    badge: 'text-red-400 bg-red-500/10 border-red-500/30',
    icon: XCircleIcon,
  },
  warning: {
    border: 'border-l-amber-500',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: ExclamationTriangleIcon,
  },
  info: {
    border: 'border-l-cyan-500',
    badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    icon: InformationCircleIcon,
  },
};

interface ControlToastProps {
  t: Toast;
  variant: ControlToastVariant;
  category: ControlToastCategory;
  message: string;
}

export default function ControlToast({ t, variant, category, message }: ControlToastProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;
  const categoryAccent = HW_TOAST_CATEGORY_ACCENT[category] ?? 'brand';

  return (
    <div
      className={`pointer-events-auto max-w-sm w-full bg-dark-card border border-dark-border border-l-4 ${styles.border} shadow-xl rounded-lg overflow-hidden transition-all duration-300 ${
        t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      }`}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="w-full text-left px-4 py-3 hover:bg-dark-surface/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.badge.split(' ')[0]}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <span
              className={`inline-block text-[10px] font-mono font-semibold tracking-widest px-1.5 py-0.5 rounded border mb-1.5 ${HW_BADGE[categoryAccent]}`}
            >
              {category}
            </span>
            <p className="text-sm text-dark-text leading-snug">{message}</p>
          </div>
        </div>
      </button>
    </div>
  );
}
