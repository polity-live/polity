import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPayment: vi.fn(),
  deletePayment: vi.fn(),
  updatePayment: vi.fn(),
  groupName: vi.fn(),
  fireNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    payments: {
      createPayment: { fn: mocks.createPayment },
      deletePayment: { fn: mocks.deletePayment },
      updatePayment: { fn: mocks.updatePayment },
    },
  },
}));

vi.mock('../../server-helpers', () => ({
  groupName: mocks.groupName,
}));

vi.mock('../../server-notify', () => ({
  fireNotification: mocks.fireNotification,
}));

import { paymentServerMutators } from '../server-mutators';

const ctx = { userID: 'user-1', email: 'user@example.com' };
const paymentArgs = {
  id: 'payment-1',
  amount: 25,
  currency: 'EUR',
  label: 'Membership fee',
  type: 'membership_fee',
  payer_user_id: null,
  payer_group_id: null,
  receiver_user_id: null,
  receiver_group_id: 'group-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.groupName.mockResolvedValue('Group One');
  mocks.fireNotification.mockResolvedValue(undefined);
});

describe('paymentServerMutators notifications', () => {
  it('passes the created payment label to the notification helper', async () => {
    await paymentServerMutators.createPayment.fn({
      tx: { run: vi.fn() } as never,
      ctx,
      args: paymentArgs,
    });

    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyPaymentCreated', {
      senderId: 'user-1',
      groupId: 'group-1',
      groupName: 'Group One',
      paymentDescription: 'Membership fee',
    });
  });

  it('passes the deleted payment label to the notification helper', async () => {
    const tx = {
      run: vi.fn().mockResolvedValue({
        ...paymentArgs,
        payer_group_id: 'group-1',
        receiver_group_id: null,
      }),
    };

    await paymentServerMutators.deletePayment.fn({
      tx: tx as never,
      ctx,
      args: { id: 'payment-1' },
    });

    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyPaymentDeleted', {
      senderId: 'user-1',
      groupId: 'group-1',
      groupName: 'Group One',
      paymentDescription: 'Membership fee',
    });
  });
});
