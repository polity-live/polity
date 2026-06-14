import { createFileRoute } from '@tanstack/react-router';

import { HomePageContainer } from '@/features/public-landing/ui/HomePageContainer';

export const Route = createFileRoute('/')({
  component: HomePageContainer,
});
