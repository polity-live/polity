import { createFileRoute } from '@tanstack/react-router';

import { handleResendWebhookRequest } from '@/server/newsletter-routes';

export const Route = createFileRoute('/api/resend/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => handleResendWebhookRequest(request),
    },
  },
});
