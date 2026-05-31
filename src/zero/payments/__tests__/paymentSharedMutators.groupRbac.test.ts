import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { paymentSharedMutators } from '../shared-mutators';

type PaymentMutatorInput = Parameters<typeof paymentSharedMutators.createPayment.fn>[0];
type PaymentMutatorTx = PaymentMutatorInput['tx'];
type PaymentMutatorCtx = PaymentMutatorInput['ctx'];

function createTx(location: PaymentMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      payment: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): PaymentMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('paymentSharedMutators group RBAC', () => {
  it('allows payment creation when the user can manage one group endpoint', async () => {
    const tx = createTx('server');
    const firstError = new PermissionError('manage', 'groupPayments', 'group:group-1');

    canMock.mockRejectedValueOnce(firstError).mockResolvedValueOnce(undefined);

    await paymentSharedMutators.createPayment.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'payment-1',
        amount: 50,
        label: 'Membership',
        type: 'membership_fee',
        payer_user_id: null,
        payer_group_id: 'group-1',
        receiver_user_id: null,
        receiver_group_id: 'group-2',
      },
    });

    expect(tx.mutate.payment.insert).toHaveBeenCalled();
  });

  it('rejects payment deletion when the user cannot manage any group endpoint', async () => {
    const tx = createTx('server');
    const firstError = new PermissionError('manage', 'groupPayments', 'group:group-1');
    const secondError = new PermissionError('manage', 'groupPayments', 'group:group-2');

    tx.run.mockResolvedValue({
      id: 'payment-1',
      payer_group_id: 'group-1',
      receiver_group_id: 'group-2',
    });
    canMock.mockRejectedValueOnce(firstError).mockRejectedValueOnce(secondError);

    await expect(
      paymentSharedMutators.deletePayment.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { id: 'payment-1' },
      })
    ).rejects.toBe(secondError);

    expect(tx.mutate.payment.delete).not.toHaveBeenCalled();
  });
});
