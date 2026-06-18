import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { handleStripeWebhook } from './stripe-service';

const stripeWebhookSchema = z.object({
  rawBody: z.string(),
  signature: z.string().min(1),
});

export const stripeWebhookFn = createServerFn({ method: 'POST' })
  .validator(stripeWebhookSchema.parse)
  .handler(async ({ data }) => handleStripeWebhook(data));
