import { createFileRoute } from '@tanstack/react-router';

import { TermsPageContainer } from '@/features/public-pages/ui/TermsPageContainer';

export const Route = createFileRoute('/terms-and-conditions')({
  component: TermsPageContainer,
});
