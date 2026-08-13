/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  payments: [] as any[],
  querying: false,
  create: vi.fn((args: unknown) => args),
  remove: vi.fn((args: unknown) => args),
  wait: vi.fn(async (value: unknown) => value),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupPaymentsData: () => ({ payments: mocks.payments, isLoading: mocks.querying }),
}));
vi.mock('@/zero/payments/usePaymentActions', () => ({
  usePaymentActions: () => ({ createPayment: mocks.create, deletePayment: mocks.remove }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({ waitForClientApply: mocks.wait }));

import { useGroupPayments } from '../useGroupPayments';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.payments = [];
  mocks.querying = false;
  mocks.wait.mockImplementation(async value => value);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('payment-id' as any);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useGroupPayments', () => {
  it('creates payments with optional counterparties present or normalized to null', async () => {
    const { result } = renderHook(() => useGroupPayments('group'));
    await act(async () => {
      expect(
        await result.current.addPayment({
          label: 'Payment',
          type: 'donation',
          amount: 10,
          currency: 'EUR',
          direction: 'income',
        })
      ).toEqual({ success: true, paymentId: 'payment-id' });
    });
    expect(mocks.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payer_user_id: null,
        payer_group_id: null,
        receiver_user_id: null,
        receiver_group_id: null,
      })
    );
    await act(() =>
      result.current.addPayment({
        label: 'Payment',
        type: 'donation',
        amount: 10,
        currency: 'EUR',
        direction: 'expense',
        payerUserId: 'payer-user',
        payerGroupId: 'payer-group',
        receiverUserId: 'receiver-user',
        receiverGroupId: 'receiver-group',
      })
    );
    expect(mocks.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payer_user_id: 'payer-user',
        payer_group_id: 'payer-group',
        receiver_user_id: 'receiver-user',
        receiver_group_id: 'receiver-group',
      })
    );
  });

  it('returns failures and exposes both local and query loading states', async () => {
    mocks.querying = true;
    const hook = renderHook(() => useGroupPayments('group'));
    expect(hook.result.current.isLoading).toBe(true);
    mocks.querying = false;
    hook.rerender();
    expect(hook.result.current.isLoading).toBe(false);

    let reject!: (error: unknown) => void;
    mocks.wait.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      })
    );
    let pending!: Promise<any>;
    await act(async () => {
      pending = hook.result.current.addPayment({
        label: 'P',
        type: 'others',
        amount: 1,
        currency: 'EUR',
        direction: 'income',
      });
      await Promise.resolve();
    });
    expect(hook.result.current.isLoading).toBe(true);
    reject(new Error('create failed'));
    await act(() => pending);
    expect((await pending).success).toBe(false);
    expect(hook.result.current.isLoading).toBe(false);
  });

  it('deletes successfully and reports delete failures', async () => {
    const { result } = renderHook(() => useGroupPayments('group'));
    await expect(
      result.current.deletePayment('payment', 'Label', 'sender', 'Group', ['admin'])
    ).resolves.toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith({ id: 'payment' });
    mocks.wait.mockRejectedValueOnce(new Error('delete failed'));
    await expect(result.current.deletePayment('payment')).resolves.toMatchObject({
      success: false,
    });
    expect(console.error).toHaveBeenCalled();
  });
});
