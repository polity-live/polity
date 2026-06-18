import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeCreateCheckout } from './stripe-service';

const stripeCreateCheckoutSchema = z
  .object({
    priceId: z.string().min(1).optional(),
    amount: z.number().int().positive().optional(),
    userId: z.string().optional(),
    origin: z.string().optional(),
  })
  .refine(value => !(value.priceId && value.amount), {
    message: 'Choose either a Stripe price or a custom amount',
  });

export const stripeCreateCheckoutFn = createServerFn({ method: 'POST' })
  .validator(stripeCreateCheckoutSchema.parse)
  .handler(async ({ data }) => executeStripeCreateCheckout(data));
