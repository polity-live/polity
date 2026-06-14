import { useState } from 'react';

import { type PricingTierViewModel } from '@/features/payments/ui/PricingPageView';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const tierKeys = ['free', 'runningCosts', 'development', 'yourChoice'] as const;

function resolveOptionalTranslation(value: string, key: string): string {
  return value === key ? '' : value;
}
export function usePricingPageContainerController() {
  const { t, tArray } = useTranslation();
  const [customAmount, setCustomAmount] = useState('');

  const tiers: PricingTierViewModel[] = tierKeys.map(key => {
    const periodKey = `pages.pricing.tiers.${key}.period`;

    return {
      key,
      name: t(`pages.pricing.tiers.${key}.name`),
      price: t(`pages.pricing.tiers.${key}.price`),
      period: resolveOptionalTranslation(t(periodKey), periodKey),
      description: t(`pages.pricing.tiers.${key}.description`),
      features: tArray(`pages.pricing.tiers.${key}.features`).filter(
        (feature): feature is string => typeof feature === 'string'
      ),
      cta: t(`pages.pricing.tiers.${key}.cta`),
      highlighted: key === 'runningCosts',
      acceptsCustomAmount: key === 'yourChoice',
    };
  });
  return {
    t,
    tArray,
    customAmount,
    setCustomAmount,
    tiers,
  };
}
