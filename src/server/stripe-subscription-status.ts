import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeSubscriptionStatus } from './stripe-service';

const stripeSubscriptionStatusSchema = z.object({
  userId: z.string().optional(),
});

export const stripeSubscriptionStatusFn = createServerFn({ method: 'POST' })
  .validator(stripeSubscriptionStatusSchema.parse)
  .handler(async ({ data }) => executeStripeSubscriptionStatus(data));
