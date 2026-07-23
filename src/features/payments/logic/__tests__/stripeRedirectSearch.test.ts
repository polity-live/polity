import { describe, expect, it } from 'vitest';

import { splitStripeRedirectSearch, stripeRedirectSearchSchema } from '../stripeRedirectSearch';

describe('stripeRedirectSearchSchema', () => {
  it.each([
    [{ success: true }, true],
    [{ success: 'true' }, true],
    [{ success: false }, false],
    [{ success: 'false' }, false],
  ])('normalizes boolean redirect flags from %o', (input, expected) => {
    expect(stripeRedirectSearchSchema.parse(input).success).toBe(expected);
  });

  it('keeps the checkout session id as a string', () => {
    expect(
      stripeRedirectSearchSchema.parse({
        success: true,
        session_id: 'cs_test_123',
      })
    ).toMatchObject({
      success: true,
      session_id: 'cs_test_123',
    });
  });

  it('rejects invalid redirect flag values', () => {
    expect(stripeRedirectSearchSchema.safeParse({ success: 'yes' }).success).toBe(false);
  });
});

describe('splitStripeRedirectSearch', () => {
  it('classifies a successful checkout and removes Stripe redirect parameters', () => {
    expect(
      splitStripeRedirectSearch({
        tab: 'subscriptions',
        success: true,
        session_id: 'cs_test_123',
      })
    ).toEqual({
      action: {
        type: 'checkout-success',
        sessionId: 'cs_test_123',
      },
      remainingSearch: {
        tab: 'subscriptions',
      },
    });
  });

  it('classifies a customer portal return for reconciliation', () => {
    expect(
      splitStripeRedirectSearch({
        tab: 'subscriptions',
        billing_return: true,
      }).action
    ).toEqual({ type: 'billing-return' });
  });

  it('classifies a canceled checkout for the cancellation notice', () => {
    expect(
      splitStripeRedirectSearch({
        tab: 'subscriptions',
        canceled: true,
      }).action
    ).toEqual({ type: 'checkout-canceled' });
  });
});
