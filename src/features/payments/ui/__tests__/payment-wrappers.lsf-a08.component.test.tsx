/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pricingController: vi.fn(() => ({ pricing: true })),
  pricingView: vi.fn(() => null),
  plansController: vi.fn(() => ({ amount: 42 })),
  plansView: vi.fn(() => null),
  statusController: vi.fn(() => ({ active: true })),
  statusView: vi.fn(() => null),
}));

vi.mock('../usePricingPageContainerController', () => ({
  usePricingPageContainerController: mocks.pricingController,
}));
vi.mock('../PricingPageContainerView', () => ({ PricingPageContainerView: mocks.pricingView }));
vi.mock('../../hooks/useSubscriptionPlansGridController', () => ({
  useSubscriptionPlansGridController: mocks.plansController,
}));
vi.mock('../SubscriptionPlansGridView', () => ({ SubscriptionPlansGridView: mocks.plansView }));
vi.mock('../../hooks/useSubscriptionStatusController', () => ({
  useSubscriptionStatusController: mocks.statusController,
}));
vi.mock('../SubscriptionStatusView', () => ({ SubscriptionStatusView: mocks.statusView }));

import { PricingPageContainer } from '../PricingPageContainer';
import { SubscriptionPlansGrid } from '../SubscriptionPlansGrid';
import { SubscriptionStatus } from '../SubscriptionStatus';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('payment LSF wrapper contracts', () => {
  it('connects pricing, plans, and subscription status controllers to their views', () => {
    const onCustomAmount = vi.fn();
    render(
      <>
        <PricingPageContainer />
        <SubscriptionPlansGrid
          activeAmount={5}
          pendingChange={null}
          isLoading={false}
          onSubscribe={vi.fn()}
          onCustomAmount={onCustomAmount}
          onCancel={vi.fn()}
          isPlanActive={() => false}
          hasCustomPlan={false}
        />
        <SubscriptionStatus userId="user-1" refreshKey={2} />
      </>
    );

    expect(mocks.pricingView).toHaveBeenCalledOnce();
    expect(mocks.plansController).toHaveBeenCalledWith(onCustomAmount);
    expect(mocks.plansView).toHaveBeenCalledOnce();
    expect(mocks.statusController).toHaveBeenCalledWith({ userId: 'user-1', refreshKey: 2 });
    expect(mocks.statusView).toHaveBeenCalledOnce();
  });
});
