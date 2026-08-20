'use client';

import { useMemo, useState } from 'react';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface ProcedureJsonPreviewProps {
  title?: string;
  value: unknown;
}

export function ProcedureJsonPreview({ title = 'JSON compilado', value }: ProcedureJsonPreviewProps) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('JSON copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Nao foi possivel copiar');
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader title={title} subtitle="Preview F0 — nao persiste no Supabase" accent="warn" className="mb-0" />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface text-xs text-dark-text hover:border-aqua-500/50 transition-colors"
        >
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <DocumentDuplicateIcon className="w-4 h-4" />}
          Copiar
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed overflow-x-auto max-h-[420px] p-3 rounded-lg bg-dark-bg border border-dark-border text-aqua-200/90 font-mono">
        {text}
      </pre>
    </div>
  );
}
