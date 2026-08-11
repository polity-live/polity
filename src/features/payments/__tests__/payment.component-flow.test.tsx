/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({ amount, currency }: { amount: number; currency: string }) => (
    <span>
      {amount} {currency}
    </span>
  ),
}));
vi.mock('@/features/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatMajor: (amount: number, currency: string) => `${amount} ${currency}`,
    language: 'en',
  }),
}));

import { renderComponentFlow } from '@/test/render-component-flow';
import { SubscriptionPlansGridView } from '../ui/SubscriptionPlansGridView';
import { SubscriptionStatusView } from '../ui/SubscriptionStatusView';

afterEach(cleanup);

describe('payment component flow', () => {
  it('selects a plan and dispatches checkout intent', () => {
    const onSubscribe = vi.fn();
    renderComponentFlow(
      <SubscriptionPlansGridView
        activeAmount={0}
        pendingChange={null}
        isLoading={false}
        onSubscribe={onSubscribe}
        onCancel={vi.fn()}
        isPlanActive={() => false}
        hasCustomPlan={false}
        customAmount=""
        customAmountValue=""
        onAmountChange={vi.fn()}
        onCustomSubmit={vi.fn()}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="payments.plan.running.select"]')!);
    expect(onSubscribe).toHaveBeenCalledWith('running');
  });

  it('shows synchronized subscription status and a stable error state', () => {
    const { rerender } = renderComponentFlow(
      <SubscriptionStatusView
        isLoading={false}
        error={null}
        data={{
          hasCustomer: true,
          hasSubscription: true,
          subscription: {
            id: 'sub-1',
            status: 'active',
            amount: 200,
            currency: 'EUR',
            interval: 'month',
            currentPeriodStart: '2026-08-01T00:00:00Z',
            currentPeriodEnd: '2026-09-01T00:00:00Z',
            cancelAtPeriodEnd: false,
          },
          allSubscriptions: [],
          payments: [],
        }}
      />
    );
    expect(screen.getByText(/active/i)).toBeTruthy();
    rerender(<SubscriptionStatusView isLoading={false} error="sync failed" data={null} />);
    expect(screen.getByText(/failed to load subscription data/i)).toBeTruthy();
  });
});
