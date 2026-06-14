import { createFileRoute } from '@tanstack/react-router';

import { SupportPageContainer } from '@/features/public-pages/ui/SupportPageContainer';

export const Route = createFileRoute('/support')({
  component: SupportPageContainer,
});
