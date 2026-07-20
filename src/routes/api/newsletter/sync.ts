import { createFileRoute } from '@tanstack/react-router';

import { handleNewsletterSyncRequest } from '@/server/newsletter-routes';

export const Route = createFileRoute('/api/newsletter/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => handleNewsletterSyncRequest(request),
    },
  },
});
