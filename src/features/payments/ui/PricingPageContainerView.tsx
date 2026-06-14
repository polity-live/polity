import { PricingPageView } from '@/features/payments/ui/PricingPageView';
export interface PricingPageContainerViewProps {
  t: any;
  tArray: any;
  customAmount: any;
  setCustomAmount: any;
  tiers: any;
}

export function PricingPageContainerView({
  t,
  customAmount,
  setCustomAmount,
  tiers,
}: PricingPageContainerViewProps) {
  return (
    <PricingPageView
      title={t('pages.pricing.title')}
      subtitle={t('pages.pricing.subtitle')}
      tiers={tiers}
      customAmount={customAmount}
      onCustomAmountChange={setCustomAmount}
      customAmountLabel={t('pages.pricing.tiers.yourChoice.name')}
      philosophyTitle={t('pages.pricing.philosophy.title')}
      philosophyIntro={t('pages.pricing.philosophy.intro')}
      philosophyBold={t('pages.pricing.philosophy.allFeaturesFreeBold')}
      philosophyAfterBold={t('pages.pricing.philosophy.afterBold')}
      enterpriseTitle={t('pages.pricing.enterprise.title')}
      enterpriseDescription={t('pages.pricing.enterprise.description')}
      enterpriseCta={t('pages.pricing.enterprise.cta')}
    />
  );
}
