/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionPlansGridView } from '../SubscriptionPlansGridView';

vi.mock('@/features/shared/hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatMajor: (amount: number) => `€${amount.toFixed(2)}`,
    language: 'en',
  }),
}));

vi.mock('@/features/shared/ui/currency', () => ({
  ConvertedCurrencyAmount: ({ amount }: { amount: number }) => <span>€{amount.toFixed(2)}</span>,
}));

afterEach(() => {
  cleanup();
});

const pendingChange = {
  target: 'free' as const,
  effectiveAt: '2026-07-23T00:00:00.000Z',
};

function renderPlans({
  activeAmount,
  hasCustomPlan = false,
  scheduled = true,
}: {
  activeAmount: number;
  hasCustomPlan?: boolean;
  scheduled?: boolean;
}) {
  return render(
    <SubscriptionPlansGridView
      activeAmount={activeAmount}
      pendingChange={scheduled ? pendingChange : null}
      isLoading={false}
      onSubscribe={vi.fn()}
      onCancel={vi.fn()}
      isPlanActive={amount => amount === activeAmount}
      hasCustomPlan={hasCustomPlan}
      customAmount=""
      customAmountValue="0"
      onAmountChange={vi.fn()}
      onCustomSubmit={vi.fn()}
    />
  );
}

describe('SubscriptionPlansGridView pending Free change', () => {
  it.each([
    ['Running Costs', 200, false],
    ['Development', 1000, false],
    ['Your Choice', 2000, true],
  ])('marks %s as active until the change date', (planName, activeAmount, hasCustomPlan) => {
    renderPlans({ activeAmount, hasCustomPlan });

    expect(screen.getByRole('heading', { name: planName })).toBeTruthy();
    expect(screen.getByText('Active until 7/23/2026')).toBeTruthy();
    expect(screen.getByText('You will automatically switch to Free after that.')).toBeTruthy();
  });

  it('marks Free as the next plan and prevents scheduling the change twice', () => {
    renderPlans({ activeAmount: 200 });

    expect(screen.getByText('Next plan')).toBeTruthy();
    expect(screen.getByText('Free from 7/23/2026')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Change scheduled' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('keeps the normal current and switch actions without a pending change', () => {
    renderPlans({ activeAmount: 200, scheduled: false });

    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.queryByText('Next plan')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Switch to Free' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('dispatches all plan transitions through stable disabled-aware actions', () => {
    const onSubscribe = vi.fn();
    const onCancel = vi.fn();
    const onCustomSubmit = vi.fn();
    const props = {
      pendingChange: null,
      isLoading: false,
      onSubscribe,
      onCancel,
      hasCustomPlan: false,
      customAmount: '5',
      customAmountValue: '5',
      onAmountChange: vi.fn(),
      onCustomSubmit,
    };
    const { container, rerender } = render(
      <SubscriptionPlansGridView
        {...props}
        activeAmount={0}
        isPlanActive={amount => amount === 0}
      />
    );

    const free = container.querySelector(
      '[data-action-id="payments.plan.free.select"]'
    ) as HTMLButtonElement;
    const running = container.querySelector(
      '[data-action-id="payments.plan.running.select"]'
    ) as HTMLButtonElement;
    const development = container.querySelector(
      '[data-action-id="payments.plan.development.select"]'
    ) as HTMLButtonElement;
    const custom = container.querySelector(
      '[data-action-id="payments.plan.custom.select"]'
    ) as HTMLButtonElement;

    expect(free.disabled).toBe(true);
    running.focus();
    expect(document.activeElement).toBe(running);
    fireEvent.click(running);
    fireEvent.click(development);
    fireEvent.click(custom);
    expect(onSubscribe).toHaveBeenNthCalledWith(1, 'running');
    expect(onSubscribe).toHaveBeenNthCalledWith(2, 'development');
    expect(onCustomSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <SubscriptionPlansGridView
        {...props}
        activeAmount={200}
        isPlanActive={amount => amount === 200}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="payments.plan.free.select"]') as HTMLButtonElement
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
