import { createFileRoute } from '@tanstack/react-router';

import { PrivacyPolicyPageContainer } from '@/features/public-pages/ui/PrivacyPolicyPageContainer';

export const Route = createFileRoute('/privacy-policy')({
  component: PrivacyPolicyPageContainer,
});
