/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  formatDistanceToNow: vi.fn((_date: Date, _options: { addSuffix: boolean }) => 'relative date'),
  minorToMajor: vi.fn((amount: number, _currency: string) => amount / 100),
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => key,
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: ({ className }: { className?: string }) => (
    <span data-icon="paid" className={className} />
  ),
  Clock: ({ className }: { className?: string }) => (
    <span data-icon="pending" className={className} />
  ),
  XCircle: ({ className }: { className?: string }) => (
    <span data-icon="failed" className={className} />
  ),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date, options: { addSuffix: boolean }) =>
    mocks.formatDistanceToNow(date, options),
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  InlineNotice: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <aside data-notice={variant}>{children}</aside>
  ),
  SectionSkeleton: ({ rows }: { rows: number }) => <div data-skeleton={rows} />,
}));

vi.mock('@/features/shared/ui/form', () => ({
  SettingsPanel: ({
    children,
    description,
    title,
  }: {
    children?: React.ReactNode;
    description?: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
}));

vi.mock('@/features/shared/ui/status', () => ({
  StatusBadge: ({
    children,
    status,
    tone,
  }: {
    children: React.ReactNode;
    status: string;
    tone?: string;
  }) => (
    <span data-status={status} data-tone={tone}>
      {children}
    </span>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `t:${key}`,
}));

vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({
    amount,
    currency,
    date,
  }: {
    amount: number;
    currency: string;
    date?: string;
  }) => (
    <span data-currency={currency} data-date={date}>
      {amount}
    </span>
  ),
}));

vi.mock('@/features/shared/logic/currency', () => ({
  minorToMajor: (amount: number, currency: string) => mocks.minorToMajor(amount, currency),
}));

import { SubscriptionStatusView, type SubscriptionData } from '../SubscriptionStatusView';

const subscription = (
  id: string,
  status: string,
  overrides: Partial<SubscriptionData['allSubscriptions'][number]> = {}
): SubscriptionData['allSubscriptions'][number] => ({
  id,
  status,
  amount: 1299,
  currency: 'EUR',
  interval: 'month',
  createdAt: '2025-01-02T12:00:00.000Z',
  canceledAt: null,
  ...overrides,
});

const payment = (
  id: string,
  status: string,
  paidAt: string | null
): SubscriptionData['payments'][number] => ({
  id,
  status,
  amount: 2500,
  currency: 'EUR',
  createdAt: '2025-02-03T12:00:00.000Z',
  paidAt,
});

const data = (overrides: Partial<SubscriptionData> = {}): SubscriptionData => ({
  hasCustomer: true,
  hasSubscription: true,
  subscription: {
    id: 'current',
    status: 'active',
    amount: 999,
    currency: 'EUR',
    interval: 'month',
    currentPeriodStart: '2025-01-01T00:00:00.000Z',
    currentPeriodEnd: '2025-02-01T00:00:00.000Z',
    cancelAtPeriodEnd: true,
  },
  allSubscriptions: [],
  payments: [],
  ...overrides,
});

describe('SubscriptionStatusView branch coverage', () => {
  afterEach(() => {
    cleanup();
    mocks.formatDistanceToNow.mockClear();
    mocks.minorToMajor.mockClear();
  });

  it('renders loading, error, and missing-data states', () => {
    const view = render(<SubscriptionStatusView data={null} isLoading error="ignored" />);
    expect(view.container.querySelector('[data-skeleton="2"]')).not.toBeNull();

    view.rerender(<SubscriptionStatusView data={null} isLoading={false} error="failed" />);
    expect(view.container.querySelector('[data-notice="destructive"]')).not.toBeNull();

    view.rerender(<SubscriptionStatusView data={null} isLoading={false} error={null} />);
    expect(
      screen.getByText(
        't:generated.inline.1005_subscribe_to_support_the_platform_and_get_acc_ec89484d'
      )
    ).toBeDefined();
  });

  it('renders the active subscription, ten recent payment variants, and status history', () => {
    const histories = [
      subscription('ignored-current-copy', 'active'),
      subscription('trial', 'trialing'),
      subscription('canceled', 'canceled', { canceledAt: '2025-03-04T00:00:00.000Z' }),
      subscription('past-due', 'past_due'),
      subscription('unpaid', 'unpaid'),
      subscription('incomplete', 'incomplete'),
      subscription('unknown', 'custom_status'),
    ];
    const payments = Array.from({ length: 11 }, (_, index) =>
      payment(
        `payment-${index}`,
        index === 0 ? 'paid' : index === 1 ? 'failed' : 'pending',
        index === 0 ? '2025-02-04T12:00:00.000Z' : null
      )
    );

    const view = render(
      <SubscriptionStatusView
        data={data({ allSubscriptions: histories, payments })}
        isLoading={false}
        error={null}
      />
    );

    expect(view.container.querySelector('[data-notice="warning"]')).not.toBeNull();
    expect(view.container.querySelector('[data-status="active"]')?.getAttribute('data-tone')).toBe(
      'success'
    );
    expect(
      view.container.querySelector('[data-status="trialing"]')?.getAttribute('data-tone')
    ).toBe('info');
    for (const status of ['canceled', 'past_due', 'unpaid']) {
      expect(
        view.container.querySelector(`[data-status="${status}"]`)?.getAttribute('data-tone')
      ).toBe('destructive');
    }
    expect(view.container.querySelector('[data-status="custom_status"]')?.textContent).toBe(
      'custom_status'
    );
    expect(view.container.querySelectorAll('[data-icon]')).toHaveLength(10);
    expect(view.container.querySelectorAll('[data-icon="paid"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-icon="failed"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-icon="pending"]')).toHaveLength(8);
    expect(screen.queryByText('payment-10')).toBeNull();
    expect(mocks.formatDistanceToNow).toHaveBeenCalledOnce();
    expect(mocks.minorToMajor).toHaveBeenCalled();
  });

  it('omits cancellation notice and uses the previous subscription summary', () => {
    const current = data();
    if (!current.subscription) throw new Error('fixture requires current subscription');
    current.subscription.cancelAtPeriodEnd = false;
    const view = render(<SubscriptionStatusView data={current} isLoading={false} error={null} />);
    expect(view.container.querySelector('[data-notice="warning"]')).toBeNull();

    view.rerender(
      <SubscriptionStatusView
        data={data({
          subscription: null,
          hasSubscription: false,
          allSubscriptions: [subscription('previous', 'incomplete')],
        })}
        isLoading={false}
        error={null}
      />
    );
    expect(
      view.container.querySelector('[data-status="incomplete"]')?.getAttribute('data-tone')
    ).toBe('outline');
    expect(
      screen.getByText(
        't:generated.inline.1010_you_previously_had_a_subscription_that_is_now_09847690'
      )
    ).toBeDefined();
  });

  it('handles absent subscription and payment arrays as empty collections', () => {
    const emptyData = data({
      subscription: null,
      hasSubscription: false,
      allSubscriptions: null as unknown as SubscriptionData['allSubscriptions'],
      payments: null as unknown as SubscriptionData['payments'],
    });
    const view = render(<SubscriptionStatusView data={emptyData} isLoading={false} error={null} />);

    expect(
      screen.getByText('t:generated.inline.1012_no_subscription_found_1654b473')
    ).toBeDefined();
    expect(view.container.querySelector('[data-icon]')).toBeNull();
  });
});
