import { createFileRoute } from '@tanstack/react-router';

import { handleStripeWebhookRequest } from '@/server/stripe-webhook-route';

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => handleStripeWebhookRequest(request),
    },
  },
});
