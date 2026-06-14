import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/imprint')({
  beforeLoad: () => {
    throw redirect({ to: '/', hash: 'imprint' });
  },
  component: () => null,
});
