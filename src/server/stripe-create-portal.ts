import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { executeStripeCreatePortal } from './stripe-service';

const stripeCreatePortalSchema = z.object({}).strict();

export const stripeCreatePortalFn = createServerFn({ method: 'POST' })
  .validator(stripeCreatePortalSchema.parse)
  .handler(async ({ data }) => executeStripeCreatePortal(data));
