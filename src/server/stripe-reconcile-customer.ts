import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeReconcileCustomer } from './stripe-service';

const stripeReconcileCustomerSchema = z.object({
  userId: z.string().optional(),
});

export const stripeReconcileCustomerFn = createServerFn({ method: 'POST' })
  .validator(stripeReconcileCustomerSchema.parse)
  .handler(async ({ data }) => executeStripeReconcileCustomer(data));
