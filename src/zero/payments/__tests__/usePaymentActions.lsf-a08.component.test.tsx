/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((value: unknown) => ({ value })),
  onServerError: vi.fn((_result: unknown, callback: () => void) => callback()),
  track: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const mutators = vi.hoisted(() => {
  const mutation = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    createCustomer: mutation('createCustomer'),
    updateSubscription: mutation('updateSubscription'),
    recordPayment: mutation('recordPayment'),
    createPayment: mutation('createPayment'),
    updatePayment: mutation('updatePayment'),
    deletePayment: mutation('deletePayment'),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../mutators', () => ({ mutators: { payments: mutators } }));
vi.mock('../../mutate-with-server-check', () => ({ onServerError: mocks.onServerError }));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.track,
}));

import { usePaymentActions } from '../usePaymentActions';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePaymentActions LSF action adapters', () => {
  it('executes every customer, subscription, and payment adapter', () => {
    const { result } = renderHook(() => usePaymentActions());
    const args = { id: 'entity-1' } as never;
    const options = { silent: true } as never;

    act(() => {
      result.current.createCustomer(args, options);
      result.current.updateSubscription(args);
      result.current.recordPayment(args);
      result.current.createPayment(args, options);
      result.current.updatePayment(args);
      result.current.deletePayment(args);
    });

    expect(mocks.mutate).toHaveBeenCalledTimes(6);
    expect(mocks.track).toHaveBeenCalledTimes(2);
    expect(mocks.onServerError).toHaveBeenCalledTimes(4);
    expect(mocks.success).toHaveBeenCalledTimes(4);
    expect(mocks.error).toHaveBeenCalledTimes(4);
  });
});
