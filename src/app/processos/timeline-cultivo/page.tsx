import type { Metadata } from 'next';
import { Suspense } from 'react';
import TimelineCultivoClient from './TimelineCultivoClient';

export const metadata: Metadata = {
  title: 'Timeline de cultivo — preview | HydroWave',
  description:
    'Designer de ciclo de cultivo (0–14 semanas): EC/pH alvo, eventos P1–P4 e simulação com dados fictícios.',
};

export default function TimelineCultivoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-bg" />}>
      <TimelineCultivoClient />
    </Suspense>
  );
}
