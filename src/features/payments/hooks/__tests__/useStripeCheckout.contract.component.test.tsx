/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  redirect: { action: { type: 'none' }, remainingSearch: {} } as any,
  navigate: vi.fn(),
  session: { access_token: 'access-token' } as { access_token?: string } | null,
  createCheckout: vi.fn(),
  cancel: vi.fn(),
  repair: vi.fn(),
  portal: vi.fn(),
  reconcile: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  split: vi.fn(),
  majorToMinor: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock('@/server/stripe-create-checkout', () => ({
  stripeCreateCheckoutFn: mocks.createCheckout,
}));
vi.mock('@/server/stripe-cancel-subscription', () => ({
  stripeCancelSubscriptionFn: mocks.cancel,
}));
vi.mock('@/server/stripe-repair-checkout-session', () => ({
  stripeRepairCheckoutSessionFn: mocks.repair,
}));
vi.mock('@/server/stripe-create-portal', () => ({ stripeCreatePortalFn: mocks.portal }));
vi.mock('@/server/stripe-reconcile-customer', () => ({
  stripeReconcileCustomerFn: mocks.reconcile,
}));
vi.mock('@/features/payments/logic/stripeRedirectSearch', () => ({
  splitStripeRedirectSearch: (search: unknown) => {
    mocks.split(search);
    return mocks.redirect;
  },
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/logic/currency', () => ({
  majorToMinor: (...args: unknown[]) => mocks.majorToMinor(...args),
}));

import { useStripeCheckout } from '../useStripeCheckout';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/payments');
  mocks.search = {};
  mocks.redirect = { action: { type: 'none' }, remainingSearch: {} };
  mocks.session = { access_token: 'access-token' };
  mocks.createCheckout.mockResolvedValue({ url: '#checkout' });
  mocks.cancel.mockResolvedValue({ success: true });
  mocks.repair.mockResolvedValue({});
  mocks.portal.mockResolvedValue({ url: '#portal' });
  mocks.reconcile.mockResolvedValue({});
  mocks.majorToMinor.mockReturnValue(1234);
});

describe('useStripeCheckout redirect reconciliation', () => {
  it('ignores unrelated redirect state', () => {
    renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    expect(mocks.split).toHaveBeenCalledWith({});
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('waits for authentication before repairing a successful checkout', () => {
    mocks.session = null;
    mocks.redirect = {
      action: { type: 'checkout-success', sessionId: 'cs_1' },
      remainingSearch: { tab: 'plans' },
    };
    renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    expect(mocks.repair).not.toHaveBeenCalled();
  });

  it('repairs checkout success once, clears redirect search and notifies subscribers', async () => {
    const onSubscriptionChange = vi.fn();
    mocks.redirect = {
      action: { type: 'checkout-success', sessionId: 'cs_1' },
      remainingSearch: { tab: 'plans' },
    };
    const { rerender } = renderHook(() =>
      useStripeCheckout({ userId: 'user-1', onSubscriptionChange })
    );
    await waitFor(() => expect(mocks.repair).toHaveBeenCalledTimes(1));
    expect(mocks.repair).toHaveBeenCalledWith({
      data: { sessionId: 'cs_1', userId: 'user-1' },
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'generated.inline.0973_subscription_successful_thank_you_for_your_su_5b3118fb'
    );
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/payments',
      search: { tab: 'plans' },
      replace: true,
    });
    expect(onSubscriptionChange).toHaveBeenCalledTimes(1);

    mocks.search = { rerender: true };
    rerender();
    await Promise.resolve();
    expect(mocks.repair).toHaveBeenCalledTimes(1);
  });

  it('reconciles a success without session id and still shows success', async () => {
    mocks.redirect = {
      action: { type: 'checkout-success', sessionId: undefined },
      remainingSearch: {},
    };
    renderHook(() => useStripeCheckout({ userId: undefined }));
    await waitFor(() =>
      expect(mocks.reconcile).toHaveBeenCalledWith({
        data: { userId: undefined },
        headers: { Authorization: 'Bearer access-token' },
      })
    );
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('logs failed billing reconciliation, then reports sync and clears search', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.reconcile.mockRejectedValue(new Error('stripe offline'));
    mocks.redirect = {
      action: { type: 'billing-return' },
      remainingSearch: { tab: 'billing' },
    };
    renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith('features.payments.billing.synced')
    );
    expect(consoleError).toHaveBeenCalledWith('Stripe reconciliation failed:', expect.any(Error));
    expect(mocks.navigate).toHaveBeenCalled();
  });

  it('handles checkout cancellation only once', () => {
    mocks.redirect = {
      action: { type: 'checkout-canceled' },
      remainingSearch: { tab: 'plans' },
    };
    const { rerender } = renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      'generated.inline.0974_subscription_canceled_you_can_subscribe_anyti_7b8dd755'
    );
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    mocks.search = { rerender: true };
    rerender();
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1);
  });
});

describe('useStripeCheckout actions', () => {
  it('blocks every protected action without an access token and validates empty inputs', async () => {
    mocks.session = null;
    const { result } = renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    await act(async () => result.current.handleSubscribe('running'));
    await act(async () => result.current.handleCustomAmount(10));
    await act(async () => result.current.handleCancelSubscription('sub_1'));
    await act(async () => result.current.handleManageBilling());
    await act(async () => result.current.handleCustomAmount(0));
    await act(async () => result.current.handleCancelSubscription(''));
    expect(mocks.toastError).toHaveBeenCalledTimes(4);
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.portal).not.toHaveBeenCalled();
  });

  it('creates plan checkout, reports a missing URL and catches failures', async () => {
    mocks.createCheckout
      .mockResolvedValueOnce({ url: '#running' })
      .mockResolvedValueOnce({ url: null })
      .mockRejectedValueOnce(new Error('checkout failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useStripeCheckout({ userId: 'user-1' }));

    await act(async () => result.current.handleSubscribe('running'));
    expect(window.location.hash).toBe('#running');
    expect(mocks.createCheckout).toHaveBeenLastCalledWith({
      data: { plan: 'running', userId: 'user-1' },
      headers: { Authorization: 'Bearer access-token' },
    });
    await act(async () => result.current.handleSubscribe('development'));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0975_failed_to_create_checkout_session_abc0e04f'
    );
    await act(async () => result.current.handleSubscribe('running'));
    expect(mocks.toastError).toHaveBeenCalledWith('generated.inline.0976_checkout_error_6173a608');
    expect(consoleError).toHaveBeenCalledWith('Checkout error:', expect.any(Error));
    expect(result.current.isCheckoutLoading).toBe(false);
  });

  it('creates custom checkout in minor units and covers missing URL and errors', async () => {
    mocks.createCheckout
      .mockResolvedValueOnce({ url: '#custom' })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('custom failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useStripeCheckout({ userId: undefined }));
    await act(async () => result.current.handleCustomAmount(12.34));
    expect(mocks.majorToMinor).toHaveBeenCalledWith(12.34, 'EUR');
    expect(mocks.createCheckout).toHaveBeenLastCalledWith({
      data: { plan: 'custom', amount: 1234, userId: undefined },
      headers: { Authorization: 'Bearer access-token' },
    });
    await act(async () => result.current.handleCustomAmount(1));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0975_failed_to_create_checkout_session_abc0e04f'
    );
    await act(async () => result.current.handleCustomAmount(2));
    expect(consoleError).toHaveBeenCalledWith('Checkout error:', expect.any(Error));
  });

  it('handles successful, rejected and failed subscription cancellation', async () => {
    const onSubscriptionChange = vi.fn();
    mocks.cancel
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce(new Error('cancel failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() =>
      useStripeCheckout({ userId: 'user-1', onSubscriptionChange })
    );
    await act(async () => result.current.handleCancelSubscription('sub_1'));
    expect(mocks.reconcile).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'features.payments.plans.cancellationScheduled'
    );
    expect(onSubscriptionChange).toHaveBeenCalled();
    await act(async () => result.current.handleCancelSubscription('sub_2'));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'generated.inline.0978_failed_to_cancel_subscription_9291c45e'
    );
    await act(async () => result.current.handleCancelSubscription('sub_3'));
    expect(consoleError).toHaveBeenCalledWith('Cancel error:', expect.any(Error));
  });

  it('creates billing portal, reports missing URL and catches errors', async () => {
    mocks.portal
      .mockResolvedValueOnce({ url: '#portal' })
      .mockResolvedValueOnce({ url: null })
      .mockRejectedValueOnce(new Error('portal failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useStripeCheckout({ userId: 'user-1' }));
    await act(async () => result.current.handleManageBilling());
    expect(window.location.hash).toBe('#portal');
    expect(mocks.portal).toHaveBeenCalledWith({
      data: {},
      headers: { Authorization: 'Bearer access-token' },
    });
    await act(async () => result.current.handleManageBilling());
    expect(mocks.toastError).toHaveBeenCalledWith('features.payments.billing.portalError');
    await act(async () => result.current.handleManageBilling());
    expect(consoleError).toHaveBeenCalledWith('Billing portal error:', expect.any(Error));
    expect(result.current.isCheckoutLoading).toBe(false);
  });
});
