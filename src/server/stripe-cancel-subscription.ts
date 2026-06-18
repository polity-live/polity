import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeCancelSubscription } from './stripe-service';

const stripeCancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
});

export const stripeCancelSubscriptionFn = createServerFn({ method: 'POST' })
  .validator(stripeCancelSubscriptionSchema.parse)
  .handler(async ({ data }) => executeStripeCancelSubscription(data));
