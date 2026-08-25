export type { AutomationRule } from './AutomacaoPageClient';

import dynamic from 'next/dynamic';
import TranslatedBrandLoading from '@/components/TranslatedBrandLoading';

const AutomacaoPageClient = dynamic(() => import('./AutomacaoPageClient'), {
  loading: () => (
    <TranslatedBrandLoading layout="hero" showWordmark messageKey="loadingAutomation" />
  ),
});

export default function AutomacaoPage() {
  return <AutomacaoPageClient />;
}
