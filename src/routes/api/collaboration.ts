import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/collaboration')({
  server: {
    handlers: {
      POST: () =>
        Response.json(
          { error: 'Studio client outdated. Reload to use Zero sync.' },
          { status: 410 }
        ),
    },
  },
});
