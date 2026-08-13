import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  webhook: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(nextValidator: (value: unknown) => unknown) {
        validator = nextValidator;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));
vi.mock('../stripe-service', () => ({ handleStripeWebhook: mocks.webhook }));

import { stripeWebhookFn } from '../stripe-webhook';

beforeEach(() => vi.clearAllMocks());

describe('stripeWebhookFn', () => {
  it('validates and forwards the exact raw payload and signature', async () => {
    mocks.webhook.mockResolvedValue({ received: true });
    await expect(
      (stripeWebhookFn as any)({ data: { rawBody: '{"id":"evt_1"}', signature: 'sig_1' } })
    ).resolves.toEqual({ received: true });
    expect(mocks.webhook).toHaveBeenCalledWith({
      rawBody: '{"id":"evt_1"}',
      signature: 'sig_1',
    });
  });

  it('rejects missing signatures before invoking the Stripe boundary', async () => {
    expect(() => (stripeWebhookFn as any)({ data: { rawBody: '{}', signature: '' } })).toThrow();
    expect(mocks.webhook).not.toHaveBeenCalled();
  });
});
