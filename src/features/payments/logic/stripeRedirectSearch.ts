import { z } from 'zod';

export const stripeRedirectFlagSchema = z.preprocess(value => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());

export const stripeRedirectSearchSchema = z.object({
  success: stripeRedirectFlagSchema,
  canceled: stripeRedirectFlagSchema,
  session_id: z.string().optional(),
  billing_return: stripeRedirectFlagSchema,
});

export type StripeRedirectSearch = z.infer<typeof stripeRedirectSearchSchema> &
  Record<string, unknown>;

export type StripeRedirectAction =
  | { type: 'checkout-success'; sessionId?: string }
  | { type: 'billing-return' }
  | { type: 'checkout-canceled' }
  | { type: 'none' };

export function splitStripeRedirectSearch(search: StripeRedirectSearch): {
  action: StripeRedirectAction;
  remainingSearch: Record<string, unknown>;
} {
  const {
    success,
    canceled,
    session_id: sessionId,
    billing_return: billingReturn,
    ...remainingSearch
  } = search;

  if (success === true) {
    return {
      action: { type: 'checkout-success', sessionId },
      remainingSearch,
    };
  }

  if (billingReturn === true) {
    return {
      action: { type: 'billing-return' },
      remainingSearch,
    };
  }

  if (canceled === true) {
    return {
      action: { type: 'checkout-canceled' },
      remainingSearch,
    };
  }

  return {
    action: { type: 'none' },
    remainingSearch,
  };
}
