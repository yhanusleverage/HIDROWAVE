export type { AutomationRule } from './AutomacaoPageClient';

import dynamic from 'next/dynamic';
import BrandLoading from '@/components/BrandLoading';

const AutomacaoPageClient = dynamic(() => import('./AutomacaoPageClient'), {
  loading: () => (
    <BrandLoading layout="hero" showWordmark message="Carregando automação..." />
  ),
});

export default function AutomacaoPage() {
  return <AutomacaoPageClient />;
}
