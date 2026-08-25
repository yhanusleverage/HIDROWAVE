'use client';

import BrandLoading from '@/components/BrandLoading';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AppTranslations } from '@/lib/translations/app/types';

type BrandLoadingLayout = 'inline' | 'fill' | 'fullscreen' | 'hero';

type CommonKey = keyof AppTranslations['common'];

interface TranslatedBrandLoadingProps {
  messageKey?: CommonKey;
  size?: number;
  layout?: BrandLoadingLayout;
  showWordmark?: boolean;
  className?: string;
}

export default function TranslatedBrandLoading({
  messageKey = 'loading',
  size,
  layout = 'inline',
  showWordmark = false,
  className = '',
}: TranslatedBrandLoadingProps) {
  const { t } = useLanguage();
  return (
    <BrandLoading
      layout={layout}
      showWordmark={showWordmark}
      size={size}
      className={className}
      message={t.common[messageKey]}
    />
  );
}
