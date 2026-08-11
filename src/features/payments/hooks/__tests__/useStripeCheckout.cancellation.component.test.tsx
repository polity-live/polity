/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStripeCheckout } from '../useStripeCheckout';

const mocks = vi.hoisted(() => ({
  cancelSubscription: vi.fn(),
  reconcileCustomer: vi.fn(),
  createCheckout: vi.fn(),
  repairCheckout: vi.fn(),
  createPortal: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => ({}),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    session: { access_token: 'test-access-token' },
  }),
}));

vi.mock('@/server/stripe-cancel-subscription', () => ({
  stripeCancelSubscriptionFn: mocks.cancelSubscription,
}));

vi.mock('@/server/stripe-reconcile-customer', () => ({
  stripeReconcileCustomerFn: mocks.reconcileCustomer,
}));

vi.mock('@/server/stripe-create-checkout', () => ({
  stripeCreateCheckoutFn: mocks.createCheckout,
}));

vi.mock('@/server/stripe-repair-checkout-session', () => ({
  stripeRepairCheckoutSessionFn: mocks.repairCheckout,
}));

vi.mock('@/server/stripe-create-portal', () => ({
  stripeCreatePortalFn: mocks.createPortal,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

describe('useStripeCheckout cancellation feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cancelSubscription.mockResolvedValue({ success: true });
    mocks.reconcileCustomer.mockResolvedValue({});
  });

  it('reports a scheduled switch to Free after cancellation and reconciliation', async () => {
    const onSubscriptionChange = vi.fn();
    const { result } = renderHook(() =>
      useStripeCheckout({
        userId: 'user-1',
        onSubscriptionChange,
      })
    );

    await act(async () => {
      await result.current.handleCancelSubscription('sub_1');
    });

    expect(mocks.cancelSubscription).toHaveBeenCalledWith({
      data: { subscriptionId: 'sub_1' },
      headers: { Authorization: 'Bearer test-access-token' },
    });
    expect(mocks.reconcileCustomer).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Your switch to Free at the end of the billing period has been scheduled.'
    );
    expect(onSubscriptionChange).toHaveBeenCalled();
  });
});
