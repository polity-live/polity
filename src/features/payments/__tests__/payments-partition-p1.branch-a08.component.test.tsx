/* @vitest-environment jsdom */

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { session: null as null | { access_token: string } },
  status: vi.fn(),
  localizedError: 'localized-error',
  language: 'en',
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => state.auth }));
vi.mock('@/server/stripe-subscription-status', () => ({
  stripeSubscriptionStatusFn: (...args: unknown[]) => state.status(...args),
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: () => state.localizedError,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatMajor: (amount: number, currency: string) => `${amount}:${currency}`,
    language: state.language,
  }),
}));
vi.mock('@/features/shared/logic/currency', () => ({
  minorToMajor: (amount: number) => amount / 100,
}));
vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({ amount, currency }: any) => (
    <span>
      {amount}:{currency}
    </span>
  ),
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input aria-label="custom-amount" {...props} />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, disabled, size: _size, variant: _variant, ...props }: any) => (
    <button data-disabled={String(!!disabled)} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: ({ columns, data, getRowId, emptyTitle }: any) => (
    <div>
      <span>{emptyTitle}</span>
      {columns.map((column: any, index: number) => (
        <div key={column.id ?? column.accessorKey ?? index}>
          {typeof column.header === 'function' ? column.header() : column.header}
          {data.map((item: any) => (
            <React.Fragment key={`${index}-${getRowId(item)}`}>
              {column.cell?.({ row: { original: item } })}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  ),
}));

import { useSubscriptionManagement } from '../hooks/useSubscriptionManagement';
import { useSubscriptionPlansGridController } from '../hooks/useSubscriptionPlansGridController';
import { useSubscriptionStatusController } from '../hooks/useSubscriptionStatusController';
import { SubscribersTable } from '../ui/SubscribersTable';
import { SubscriptionPlansGridView } from '../ui/SubscriptionPlansGridView';

beforeEach(() => {
  vi.clearAllMocks();
  state.auth = { session: null };
  state.language = 'en';
  state.status.mockResolvedValue({ subscription: null, hasCustomer: false });
});

afterEach(cleanup);

describe('subscription hooks', () => {
  it('guards subscription fetches and covers active/fixed/custom helpers', async () => {
    const empty = renderHook(() => useSubscriptionManagement({ userId: undefined }));
    await act(() => empty.result.current.fetchSubscription());
    expect(state.status).not.toHaveBeenCalled();
    expect(empty.result.current.isPlanActive(0)).toBe(false);
    expect(empty.result.current.hasCustomPlan()).toBe(false);
    expect(empty.result.current.getActivePlanAmount()).toBe(0);
    empty.unmount();

    state.auth = { session: { access_token: 'token' } };
    state.status.mockResolvedValueOnce({
      subscription: {
        id: 'sub',
        amount: 500,
        status: 'active',
        currentPeriodEnd: 'date',
        cancelAtPeriodEnd: false,
      },
      hasCustomer: true,
    });
    const custom = renderHook(() => useSubscriptionManagement({ userId: 'user' }));
    await waitFor(() => expect(custom.result.current.activeSubscription?.amount).toBe(500));
    expect(custom.result.current.isPlanActive(500)).toBe(true);
    expect(custom.result.current.isPlanActive(200)).toBe(false);
    expect(custom.result.current.hasCustomPlan()).toBe(true);
    expect(custom.result.current.getActivePlanAmount()).toBe(500);

    state.status.mockResolvedValueOnce({
      subscription: {
        id: 'fixed',
        amount: 200,
        status: 'active',
        currentPeriodEnd: 'date',
        cancelAtPeriodEnd: false,
      },
      hasCustomer: true,
    });
    await act(() => custom.result.current.fetchSubscription());
    expect(custom.result.current.hasCustomPlan()).toBe(false);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.status.mockRejectedValueOnce(new Error('network'));
    await act(() => custom.result.current.fetchSubscription());
    expect(consoleError).toHaveBeenCalled();
    expect(custom.result.current.isLoading).toBe(false);
  });

  it('accepts only bounded digit input and submits positive custom amounts', () => {
    const onCustomAmount = vi.fn();
    const { result } = renderHook(() => useSubscriptionPlansGridController(onCustomAmount));
    expect(result.current.customAmountValue).toBe('0');
    act(() => result.current.onCustomSubmit());
    expect(onCustomAmount).not.toHaveBeenCalled();
    act(() => result.current.onAmountChange('x'));
    expect(result.current.customAmount).toBe('');
    for (const value of ['1', '2', '3', '4']) act(() => result.current.onAmountChange(value));
    expect(result.current.customAmount).toBe('123');
    act(() => result.current.onAmountChange(''));
    expect(result.current.customAmount).toBe('12');
    act(() => result.current.onCustomSubmit());
    expect(onCustomAmount).toHaveBeenCalledWith(12);
  });

  it('covers status no-token, empty-user, success and localized failure states', async () => {
    const noToken = renderHook(() => useSubscriptionStatusController({ userId: 'user' }));
    await waitFor(() => expect(noToken.result.current.isLoading).toBe(false));
    expect(state.status).not.toHaveBeenCalled();
    noToken.unmount();

    state.auth = { session: { access_token: 'token' } };
    const noUser = renderHook(() => useSubscriptionStatusController({ userId: '', refreshKey: 1 }));
    expect(noUser.result.current.isLoading).toBe(true);
    noUser.unmount();

    state.status.mockResolvedValueOnce({ subscription: { id: 'sub' }, hasCustomer: true });
    const success = renderHook(() =>
      useSubscriptionStatusController({ userId: 'user', refreshKey: 2 })
    );
    await waitFor(() => expect(success.result.current.data).toMatchObject({ hasCustomer: true }));
    success.unmount();

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.status.mockRejectedValueOnce(new Error('status'));
    const failed = renderHook(() => useSubscriptionStatusController({ userId: 'failed' }));
    await waitFor(() => expect(failed.result.current.error).toBe('localized-error'));
    expect(consoleError).toHaveBeenCalled();
  });
});

describe('payment tables and plans', () => {
  it('renders subscriber fallbacks, images, dates and remove actions', () => {
    const remove = vi.fn();
    const subscribers = [
      {
        id: 'one',
        created_at: '2024-01-02T00:00:00Z',
        subscriber_user: {
          id: 'user-one',
          first_name: 'Ada',
          last_name: 'Lovelace',
          avatar: '/ada.png',
        },
      },
      {
        id: 'two',
        created_at: null,
        subscriber_user: { id: 'user-two', first_name: null, last_name: null, avatar: null },
      },
      { id: 'ignored', subscriber_user: null },
    ];
    const view = render(<SubscribersTable subscribers={subscribers} onRemove={remove} />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('features.payments.subscriptions.unknown.user')).toBeTruthy();
    expect(screen.getByAltText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('features.payments.subscriptions.notAvailable')).toBeTruthy();
    fireEvent.click(screen.getAllByText('generated.inline.0096_remove_e963907d')[0]);
    expect(remove).toHaveBeenCalledWith('one');
    view.rerender(<SubscribersTable subscribers={[]} onRemove={remove} />);
    expect(screen.getByText('generated.inline.0979_my_subscribers_7c714699')).toBeTruthy();
  });

  it('covers inactive plan actions and custom keyboard input', () => {
    const subscribe = vi.fn();
    const cancel = vi.fn();
    const amountChange = vi.fn();
    const customSubmit = vi.fn();
    const inactive = () => false;
    render(
      <SubscriptionPlansGridView
        activeAmount={500}
        pendingChange={null}
        isLoading={false}
        onSubscribe={subscribe}
        onCancel={cancel}
        isPlanActive={inactive}
        hasCustomPlan={false}
        customAmount="12"
        customAmountValue="12"
        onAmountChange={amountChange}
        onCustomSubmit={customSubmit}
      />
    );
    fireEvent.click(screen.getByText('generated.inline.0127_switch_to_free_5a577638'));
    fireEvent.click(screen.getAllByText('generated.inline.0128_subscribe_d6981f74')[0]);
    fireEvent.click(screen.getAllByText('generated.inline.0128_subscribe_d6981f74')[1]);
    fireEvent.change(screen.getByLabelText('custom-amount'), { target: { value: '129' } });
    fireEvent.keyDown(screen.getByLabelText('custom-amount'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByLabelText('custom-amount'), { key: 'Backspace' });
    fireEvent.click(screen.getAllByText('generated.inline.0128_subscribe_d6981f74')[2]);
    expect(cancel).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith('running');
    expect(subscribe).toHaveBeenCalledWith('development');
    expect(amountChange).toHaveBeenNthCalledWith(1, '9');
    expect(amountChange).toHaveBeenNthCalledWith(2, '');
    expect(customSubmit).toHaveBeenCalled();
  });

  it('covers active, loading, pending-free, custom and both locale variants', () => {
    const common = {
      onSubscribe: vi.fn(),
      onCancel: vi.fn(),
      customAmount: '',
      customAmountValue: '0',
      onAmountChange: vi.fn(),
      onCustomSubmit: vi.fn(),
    };
    const view = render(
      <SubscriptionPlansGridView
        {...common}
        activeAmount={0}
        pendingChange={null}
        isLoading={false}
        isPlanActive={() => false}
        hasCustomPlan={false}
      />
    );
    expect(screen.getByText('generated.inline.0126_active_a733b809')).toBeTruthy();

    state.language = 'de';
    view.rerender(
      <SubscriptionPlansGridView
        {...common}
        activeAmount={200}
        pendingChange={{ effectiveAt: '2030-02-01T00:00:00Z' } as never}
        isLoading={false}
        isPlanActive={amount => amount === 200}
        hasCustomPlan={false}
      />
    );
    expect(screen.getAllByText('features.payments.plans.thenFree').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('features.payments.plans.changeScheduled'));
    fireEvent.click(screen.getAllByText('generated.inline.0126_active_a733b809')[0]);

    state.language = 'en';
    view.rerender(
      <SubscriptionPlansGridView
        {...common}
        activeAmount={1000}
        pendingChange={null}
        isLoading
        isPlanActive={amount => amount === 1000}
        hasCustomPlan={false}
      />
    );
    expect(screen.getAllByText('generated.inline.0988_processing_272bc02e')).toHaveLength(4);

    view.rerender(
      <SubscriptionPlansGridView
        {...common}
        activeAmount={1000}
        pendingChange={null}
        isLoading={false}
        isPlanActive={amount => amount === 1000}
        hasCustomPlan={false}
      />
    );
    expect(screen.getAllByText('generated.inline.0126_active_a733b809').length).toBeGreaterThan(0);

    view.rerender(
      <SubscriptionPlansGridView
        {...common}
        activeAmount={555}
        pendingChange={{ effectiveAt: '2030-02-01T00:00:00Z' } as never}
        isLoading={false}
        isPlanActive={() => false}
        hasCustomPlan
      />
    );
    expect(screen.getByText('5.55:EUR')).toBeTruthy();
    fireEvent.click(screen.getAllByText('generated.inline.0126_active_a733b809')[0]);
  });
});
