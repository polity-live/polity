import { usePricingPageContainerController } from './usePricingPageContainerController';
import { PricingPageContainerView } from './PricingPageContainerView';

export function PricingPageContainer() {
  const viewProps = usePricingPageContainerController();

  return <PricingPageContainerView {...viewProps} />;
}
