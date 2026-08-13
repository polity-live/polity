import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  can: vi.fn(),
  requireOwner: vi.fn(),
  denyPublicApiMutation: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({ defineMutator: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => state.can(...args) }));
vi.mock('../../rbac/authorize', () => ({
  requireOwner: (...args: unknown[]) => state.requireOwner(...args),
  denyPublicApiMutation: (...args: unknown[]) => state.denyPublicApiMutation(...args),
}));
vi.mock('../../rbac/errors', () => ({
  isPermissionError: (error: any) => error?.permission === true,
}));
vi.mock('../../schema', () => ({
  zql: {
    stripe_subscription: { where: () => ({ one: () => 'subscription-query' }) },
    stripe_customer: { where: () => ({ one: () => 'customer-query' }) },
    payment: { where: () => ({ one: () => 'payment-query' }) },
  },
}));
vi.mock('../schema', () => ({
  createStripeCustomerSchema: {},
  updateStripeSubscriptionSchema: {},
  createStripePaymentSchema: {},
  createPaymentSchema: {},
  updatePaymentSchema: {},
  deletePaymentSchema: {},
}));

import { paymentSharedMutators } from '../shared-mutators';

function tx(location: 'client' | 'server' = 'server') {
  return {
    location,
    run: vi.fn(),
    mutate: {
      stripe_customer: { insert: vi.fn() },
      stripe_subscription: { update: vi.fn() },
      stripe_payment: { insert: vi.fn() },
      payment: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
  };
}

const ctx = { userID: 'user' };
const payment = (extra: Record<string, unknown> = {}) => ({
  id: 'payment',
  amount: 10,
  currency: 'EUR',
  label: 'Fee',
  type: 'fee',
  payer_user_id: null,
  payer_group_id: null,
  receiver_user_id: null,
  receiver_group_id: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.can.mockResolvedValue(undefined);
});

describe('paymentSharedMutators complete parity and authorization matrix', () => {
  it('creates customers and records server payments with timestamps', async () => {
    const target = tx();
    await paymentSharedMutators.createCustomer.fn({
      tx: target as never,
      ctx: ctx as never,
      args: { id: 'customer', user_id: 'user', stripe_customer_id: 'cus' } as never,
    });
    expect(state.requireOwner).toHaveBeenCalled();
    expect(target.mutate.stripe_customer.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: expect.any(Number), updated_at: expect.any(Number) })
    );

    await paymentSharedMutators.recordPayment.fn({
      tx: target as never,
      ctx: ctx as never,
      args: { id: 'stripe-payment' } as never,
    });
    expect(state.denyPublicApiMutation).toHaveBeenCalled();
    expect(target.mutate.stripe_payment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: expect.any(Number) })
    );
  });

  it('updates subscriptions on client and checks missing/present server ownership', async () => {
    const client = tx('client');
    await paymentSharedMutators.updateSubscription.fn({
      tx: client as never,
      ctx: ctx as never,
      args: { id: 'subscription' } as never,
    });
    expect(client.run).not.toHaveBeenCalled();

    const missing = tx();
    missing.run.mockResolvedValueOnce(null);
    await paymentSharedMutators.updateSubscription.fn({
      tx: missing as never,
      ctx: ctx as never,
      args: { id: 'missing' } as never,
    });
    expect(state.requireOwner).toHaveBeenLastCalledWith(missing, ctx, undefined, expect.anything());

    const found = tx();
    found.run
      .mockResolvedValueOnce({ customer_id: 'customer' })
      .mockResolvedValueOnce({ user_id: 'owner' });
    await paymentSharedMutators.updateSubscription.fn({
      tx: found as never,
      ctx: ctx as never,
      args: { id: 'found' } as never,
    });
    expect(state.requireOwner).toHaveBeenLastCalledWith(found, ctx, 'owner', expect.anything());
    expect(found.mutate.stripe_subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ updated_at: expect.any(Number) })
    );
  });

  it('creates unscoped, deduplicated and fallback-authorized group payments', async () => {
    const unscoped = tx();
    await paymentSharedMutators.createPayment.fn({
      tx: unscoped as never,
      ctx: ctx as never,
      args: payment() as never,
    });
    expect(state.can).not.toHaveBeenCalled();

    const scoped = tx();
    await paymentSharedMutators.createPayment.fn({
      tx: scoped as never,
      ctx: ctx as never,
      args: payment({ payer_group_id: 'same', receiver_group_id: 'same' }) as never,
    });
    expect(state.can).toHaveBeenCalledTimes(1);

    state.can
      .mockReset()
      .mockRejectedValueOnce({ permission: true })
      .mockResolvedValueOnce(undefined);
    await paymentSharedMutators.createPayment.fn({
      tx: scoped as never,
      ctx: ctx as never,
      args: payment({ payer_group_id: 'first', receiver_group_id: 'second' }) as never,
    });
    expect(state.can).toHaveBeenCalledTimes(2);
    expect(scoped.mutate.payment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: expect.any(Number) })
    );
  });

  it('propagates non-permission errors and the final permission error', async () => {
    const target = tx();
    const unexpected = new Error('database');
    state.can.mockRejectedValueOnce(unexpected);
    await expect(
      paymentSharedMutators.createPayment.fn({
        tx: target as never,
        ctx: ctx as never,
        args: payment({ payer_group_id: 'group' }) as never,
      })
    ).rejects.toBe(unexpected);

    const first = { permission: true, id: 'first' };
    const last = { permission: true, id: 'last' };
    state.can.mockReset().mockRejectedValueOnce(first).mockRejectedValueOnce(last);
    await expect(
      paymentSharedMutators.createPayment.fn({
        tx: target as never,
        ctx: ctx as never,
        args: payment({ payer_group_id: 'first', receiver_group_id: 'last' }) as never,
      })
    ).rejects.toBe(last);
  });

  it.each(['updatePayment', 'deletePayment'] as const)(
    'covers client, missing and authorized server %s',
    async mutatorName => {
      const args =
        mutatorName === 'updatePayment' ? { id: 'payment', label: 'Updated' } : { id: 'payment' };
      const client = tx('client');
      await paymentSharedMutators[mutatorName].fn({
        tx: client as never,
        ctx: ctx as never,
        args: args as never,
      });
      expect(client.run).not.toHaveBeenCalled();

      const missing = tx();
      missing.run.mockResolvedValueOnce(null);
      await expect(
        paymentSharedMutators[mutatorName].fn({
          tx: missing as never,
          ctx: ctx as never,
          args: args as never,
        })
      ).rejects.toThrow('Payment not found');

      const found = tx();
      found.run.mockResolvedValueOnce(payment({ payer_group_id: 'group' }));
      await paymentSharedMutators[mutatorName].fn({
        tx: found as never,
        ctx: ctx as never,
        args: args as never,
      });
      expect(state.can).toHaveBeenCalled();
      if (mutatorName === 'updatePayment')
        expect(found.mutate.payment.update).toHaveBeenCalledWith(args);
      else expect(found.mutate.payment.delete).toHaveBeenCalledWith({ id: 'payment' });
    }
  );
});
