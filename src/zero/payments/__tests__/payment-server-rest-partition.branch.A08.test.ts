import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  groupName: vi.fn(),
  fireNotification: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({ defineMutator: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../../mutators', () => ({
  mutators: {
    payments: {
      createPayment: { fn: state.createPayment },
      updatePayment: { fn: state.updatePayment },
      deletePayment: { fn: state.deletePayment },
    },
  },
}));
vi.mock('../../server-helpers', () => ({ groupName: state.groupName }));
vi.mock('../../server-notify', () => ({ fireNotification: state.fireNotification }));
vi.mock('../../schema', () => ({
  zql: { payment: { where: () => ({ one: () => 'payment-query' }) } },
}));
vi.mock('../schema', () => ({
  createPaymentSchema: {},
  updatePaymentSchema: {},
  deletePaymentSchema: {},
}));

import { paymentServerMutators } from '../server-mutators';

const ctx = { userID: 'user' };
const payment = (extra: Record<string, unknown> = {}) => ({
  id: 'payment',
  label: 'Fee',
  payer_group_id: null,
  receiver_group_id: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.groupName.mockResolvedValue('Group');
});

describe('payment server-mutator notification boundaries', () => {
  it('does not notify for an unscoped created payment and delegates updates', async () => {
    const tx = { run: vi.fn() };
    await paymentServerMutators.createPayment.fn({
      tx: tx as never,
      ctx: ctx as never,
      args: payment() as never,
    });
    expect(state.fireNotification).not.toHaveBeenCalled();
    await paymentServerMutators.updatePayment.fn({
      tx: tx as never,
      ctx: ctx as never,
      args: { id: 'payment', label: 'Updated' } as never,
    });
    expect(state.updatePayment).toHaveBeenCalled();
  });

  it('uses the receiver endpoint for deletion notifications', async () => {
    const tx = { run: vi.fn().mockResolvedValue(payment({ receiver_group_id: 'receiver' })) };
    await paymentServerMutators.deletePayment.fn({
      tx: tx as never,
      ctx: ctx as never,
      args: { id: 'payment' } as never,
    });
    expect(state.fireNotification).toHaveBeenCalledWith(
      'notifyPaymentDeleted',
      expect.objectContaining({ groupId: 'receiver', paymentDescription: 'Fee' })
    );
  });

  it('does not notify when the deleted payment no longer exists', async () => {
    const tx = { run: vi.fn().mockResolvedValue(null) };
    await paymentServerMutators.deletePayment.fn({
      tx: tx as never,
      ctx: ctx as never,
      args: { id: 'missing' } as never,
    });
    expect(state.fireNotification).not.toHaveBeenCalled();
  });
});
