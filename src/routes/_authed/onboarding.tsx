import { createFileRoute } from '@tanstack/react-router';

import { TutorialLauncherPage } from '@/features/app-tutorial/TutorialLauncherPage';

export const Route = createFileRoute('/_authed/onboarding')({
  validateSearch: search => ({
    restart: search.restart === true || search.restart === 'true',
  }),
  component: TutorialLauncherPage,
});
