import type { Metadata } from 'next';
import MarketingShell from '@/components/MarketingShell';
import QuemSomosContent from '@/components/QuemSomosContent';

export const metadata: Metadata = {
  title: 'Quem Somos | HydroWave',
  description:
    'Controle hidropônico com clareza: pH, EC, temperatura, nível e automação do campo à nuvem.',
};

export default function QuemSomosPage() {
  return (
    <MarketingShell>
      <QuemSomosContent />
    </MarketingShell>
  );
}
