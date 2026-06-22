'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { HwButton } from './HwButton';

export interface HwModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
}

const SIZE_CLASSES = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(96vw,1200px)]',
};

export function HwModal({
  open,
  onClose,
  title,
  children,
  size = 'lg',
  footer,
}: HwModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar modal"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 w-full ${SIZE_CLASSES[size]} max-h-[90vh] flex flex-col rounded-xl border border-dark-border bg-dark-card shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-dark-text">
            {title}
          </h2>
          <HwButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fechar"
            className="!p-2"
          >
            <XMarkIcon className="h-5 w-5" />
          </HwButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-dark-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
