/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConvertedCurrencyAmount } from '../ConvertedCurrencyAmount';

const mocks = vi.hoisted(() => ({
  language: 'en',
  state: {} as any,
}));

vi.mock('@/features/shared/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => mocks.state,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (_key: string, fallback?: string) => fallback,
  }),
}));

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children, content }: any) => <span data-tooltip={content}>{children}</span>,
}));

beforeEach(() => {
  mocks.language = 'en';
  mocks.state = {
    targetCurrency: 'USD',
    conversion: null,
    isLoading: false,
  };
});

afterEach(() => cleanup());

describe('ConvertedCurrencyAmount', () => {
  it('renders the original amount only when source and target currencies match', () => {
    mocks.state = {
      targetCurrency: 'EUR',
      conversion: {
        convertedAmount: 12,
        rate: 1,
        rateDate: '2026-08-09',
        cacheStatus: 'fresh',
      },
      isLoading: false,
    };
    render(<ConvertedCurrencyAmount amount={12} currency="EUR" />);

    expect(screen.queryByText('Conversion unavailable')).toBeNull();
    expect(screen.queryByText('Frankfurter')).toBeNull();
  });

  it('shows converted and original values with stale English rate metadata', () => {
    mocks.state = {
      targetCurrency: 'USD',
      conversion: {
        convertedAmount: 14,
        rate: 1.2,
        rateDate: '2026-08-08',
        cacheStatus: 'stale',
      },
      isLoading: false,
    };
    render(
      <ConvertedCurrencyAmount
        amount={12}
        currency="EUR"
        className="primary"
        secondaryClassName="secondary"
      />
    );

    expect(screen.getByText('Frankfurter')).toBeTruthy();
    expect(screen.getByText(/stale/)).toBeTruthy();
    expect(screen.getByText(/2026-08-08/).className).toContain('secondary');
  });

  it('localizes stale metadata to German', () => {
    mocks.language = 'de';
    mocks.state = {
      targetCurrency: 'USD',
      conversion: {
        convertedAmount: 14,
        rate: 1.2,
        rateDate: '2026-08-08',
        cacheStatus: 'stale',
      },
      isLoading: false,
    };
    render(<ConvertedCurrencyAmount amount={12} currency="EUR" />);
    expect(screen.getByText(/veraltet/)).toBeTruthy();
  });

  it('hides optional original metadata without claiming conversion failed', () => {
    mocks.state = {
      targetCurrency: 'USD',
      conversion: {
        convertedAmount: 14,
        rate: 1.2,
        rateDate: '2026-08-08',
        cacheStatus: 'fresh',
      },
      isLoading: false,
    };
    const fresh = render(<ConvertedCurrencyAmount amount={12} currency="EUR" />);
    expect(screen.getByText('Frankfurter')).toBeTruthy();
    expect(screen.queryByText(/stale|veraltet/)).toBeNull();
    fresh.unmount();

    render(<ConvertedCurrencyAmount amount={12} currency="EUR" showOriginal={false} />);
    expect(screen.queryByText('Frankfurter')).toBeNull();
    expect(screen.queryByText('Conversion unavailable')).toBeNull();
  });

  it('shows an unavailable message only after a failed conversion finishes loading', () => {
    const unavailable = render(<ConvertedCurrencyAmount amount={12} currency="EUR" />);
    expect(screen.getByText('Conversion unavailable')).toBeTruthy();
    unavailable.unmount();

    mocks.state = { targetCurrency: 'USD', conversion: null, isLoading: true };
    render(<ConvertedCurrencyAmount amount={12} currency="EUR" />);
    expect(screen.queryByText('Conversion unavailable')).toBeNull();
  });
});
