import { createFileRoute } from '@tanstack/react-router';

import { PricingPageContainer } from '@/features/payments/ui/PricingPageContainer';

export const Route = createFileRoute('/pricing')({
  component: PricingPageContainer,
});
