import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeCreateCheckout } from './stripe-service';

const stripeCreateCheckoutSchema = z.discriminatedUnion('plan', [
  z.object({
    plan: z.enum(['running', 'development']),
    userId: z.string().optional(),
  }),
  z.object({
    plan: z.literal('custom'),
    amount: z.number().int().min(100).max(99_900),
    userId: z.string().optional(),
  }),
]);

export const stripeCreateCheckoutFn = createServerFn({ method: 'POST' })
  .validator(stripeCreateCheckoutSchema.parse)
  .handler(async ({ data }) => executeStripeCreateCheckout(data));
