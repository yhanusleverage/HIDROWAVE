'use client';

import React from 'react';
import {
  HW_ACCENT_TOP,
  HW_BADGE,
  HW_HEADING_LG,
  HW_HEADING_MD,
  HW_LABEL,
  HW_METRIC,
  type HwAccent,
} from '@/lib/design-tokens';
import { HwBadge } from '@/components/ui/HwBadge';
import { HwButton } from '@/components/ui/HwButton';
import { HwInput, HwSelect } from '@/components/ui/HwInput';
import { InstrumentCard } from '@/components/ui/InstrumentCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricRow } from '@/components/ui/MetricRow';

const ACCENTS: HwAccent[] = ['brand', 'ec', 'ph', 'wait', 'warn', 'danger', 'ok', 'neutral'];

export default function DesignSystemPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-10">
      <header>
        <h1 className={HW_HEADING_LG}>HydroWave Design System</h1>
        <p className={`mt-2 ${HW_LABEL}`}>
          Catálogo interno de tokens e primitivas UI. Referência para manter consistência visual.
        </p>
      </header>

      <section>
        <SectionHeader title="Tipografia" accent="brand" />
        <div className="space-y-2 mt-4">
          <p className={HW_HEADING_LG}>Heading LG</p>
          <p className={HW_HEADING_MD}>Heading MD</p>
          <p className={HW_LABEL}>Label / secondary text</p>
          <p className={HW_METRIC}>1234.5</p>
        </div>
      </section>

      <section>
        <SectionHeader title="Acentos semânticos" accent="brand" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {ACCENTS.map((accent) => (
            <div key={accent} className={`rounded-lg border border-t-2 p-3 ${HW_ACCENT_TOP[accent]}`}>
              <HwBadge accent={accent}>{accent}</HwBadge>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Botões" accent="brand" />
        <div className="flex flex-wrap gap-3 mt-4">
          <HwButton variant="primary">Primary</HwButton>
          <HwButton variant="secondary">Secondary</HwButton>
          <HwButton variant="ghost">Ghost</HwButton>
          <HwButton variant="danger">Danger</HwButton>
        </div>
      </section>

      <section>
        <SectionHeader title="Formulários" accent="ec" />
        <div className="grid md:grid-cols-2 gap-4 mt-4 max-w-xl">
          <HwInput label="Input" placeholder="Valor..." />
          <HwSelect label="Select">
            <option>Opção A</option>
            <option>Opção B</option>
          </HwSelect>
        </div>
      </section>

      <section>
        <SectionHeader title="InstrumentCard + MetricRow" accent="ph" />
        <InstrumentCard accent="ph" title="Exemplo pH" className="mt-4 max-w-sm">
          <MetricRow label="Leitura" value="6.2" variant="live" />
          <MetricRow label="Setpoint" value="6.0" variant="setpoint" />
        </InstrumentCard>
      </section>

      <section>
        <SectionHeader title="Badges" accent="wait" />
        <div className="flex flex-wrap gap-2 mt-4">
          {ACCENTS.map((accent) => (
            <span key={accent} className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${HW_BADGE[accent]}`}>
              {accent}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
