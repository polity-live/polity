import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeRepairCheckoutSession } from './stripe-service';

const stripeRepairCheckoutSessionSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
});

export const stripeRepairCheckoutSessionFn = createServerFn({ method: 'POST' })
  .validator(stripeRepairCheckoutSessionSchema.parse)
  .handler(async ({ data }) => executeStripeRepairCheckoutSession(data));
