import { createAPIFileRoute } from '@tanstack/react-start/api';

import { handleStripeWebhookRequest } from '@/server/stripe-webhook-route';

export const APIRoute = createAPIFileRoute('/api/stripe/webhook')({
  POST: async ({ request }) => handleStripeWebhookRequest(request),
});
