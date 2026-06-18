import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeCreatePortal } from './stripe-service';

const stripeCreatePortalSchema = z.object({
  customerId: z.string().optional(),
  returnOrigin: z.string().optional(),
});

export const stripeCreatePortalFn = createServerFn({ method: 'POST' })
  .validator(stripeCreatePortalSchema.parse)
  .handler(async ({ data }) => executeStripeCreatePortal(data));
