/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  baseProps: undefined as Record<string, any> | undefined,
  conversionResult: {} as Record<string, any>,
  language: 'en',
  conversionArgs: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock('@/features/shared/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: (args: Record<string, any>) => {
    mocks.conversionArgs = args;
    return mocks.conversionResult;
  },
}));
vi.mock('@/features/shared/logic/currency', () => ({
  formatCurrencyMajor: (
    amount: number,
    currency: string,
    language: string,
    options?: Record<string, unknown>
  ) => `${amount}-${currency}-${language}-${options?.approximate ? 'approx' : 'exact'}`,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children, content }: { children: ReactNode; content: string }) => (
    <div data-tooltip={content}>{children}</div>
  ),
}));
vi.mock('../TimelineCardBase', () => ({
  TimelineCardBase: (props: Record<string, any>) => {
    mocks.baseProps = props;
    return <article>{props.children}</article>;
  },
  TimelineCardHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      {title}
      {subtitle ? `:${subtitle}` : ''}
    </header>
  ),
  TimelineCardContent: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  TimelineCardBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import {
  PaymentTimelineCard,
  formatTimelinePaymentDate,
  formatTimelinePaymentType,
  getTimelinePaymentRateDate,
} from '../PaymentTimelineCard';

beforeEach(() => {
  mocks.baseProps = undefined;
  mocks.conversionArgs = undefined;
  mocks.language = 'en';
  mocks.conversionResult = { conversion: null, isLoading: false, targetCurrency: 'EUR' };
});

afterEach(cleanup);

describe('payment timeline formatters', () => {
  it('handles absent, invalid, and valid dates', () => {
    expect(formatTimelinePaymentDate()).toBeNull();
    expect(formatTimelinePaymentDate(null)).toBeNull();
    expect(formatTimelinePaymentDate('invalid')).toBeNull();
    expect(formatTimelinePaymentDate('2026-08-09T10:00:00Z')).toEqual(expect.any(String));
    expect(getTimelinePaymentRateDate()).toBeUndefined();
    expect(getTimelinePaymentRateDate('invalid')).toBeUndefined();
    expect(getTimelinePaymentRateDate('2026-08-09T10:00:00Z')).toBe('2026-08-09');
  });

  it('formats meaningful payment types only', () => {
    expect(formatTimelinePaymentType()).toBeNull();
    expect(formatTimelinePaymentType('  ')).toBeNull();
    expect(formatTimelinePaymentType('membership_fee')).toBe('Membership Fee');
  });
});

describe('PaymentTimelineCard', () => {
  it('renders an income payment with original amount, metadata, and group destination', () => {
    render(
      <PaymentTimelineCard
        className="custom"
        payment={{
          id: 'payment-1',
          label: 'Membership',
          description: '  Annual fee  ',
          amount: 12,
          currency: 'EUR',
          type: 'membership_fee',
          direction: 'income',
          createdAt: '2026-08-09T10:00:00Z',
          groupId: 'group-1',
          groupName: 'Civic Group',
          counterpartyLabel: 'Ada',
        }}
      />
    );
    expect(mocks.baseProps).toMatchObject({ href: '/group/group-1', className: 'custom' });
    expect(mocks.conversionArgs).toMatchObject({ amount: 12, currency: 'EUR', date: '2026-08-09' });
    expect(screen.getByText('12-EUR-en-exact')).toBeTruthy();
    expect(screen.getByText('Annual fee')).toBeTruthy();
    expect(screen.getByText('Membership Fee')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('renders converted expense values, source details, and stale English metadata', () => {
    mocks.conversionResult = {
      conversion: {
        convertedAmount: 14,
        rate: 1.2,
        rateDate: '2026-08-08',
        cacheStatus: 'stale',
      },
      isLoading: false,
      targetCurrency: 'USD',
    };
    render(
      <PaymentTimelineCard
        href="/custom"
        payment={{
          id: 'payment-2',
          label: 'Material',
          amount: 12,
          currency: 'EUR',
          direction: 'expense',
        }}
      />
    );
    expect(mocks.baseProps?.href).toBe('/custom');
    expect(screen.getByText('14-USD-en-approx')).toBeTruthy();
    expect(document.body.textContent).toContain('12-EUR-en-exact');
    expect(document.body.textContent).toContain('stale');
  });

  it('uses exact conversion formatting when target and original currencies match', () => {
    mocks.conversionResult = {
      conversion: { convertedAmount: 10, rate: 1, rateDate: '2026-08-09', cacheStatus: 'fresh' },
      isLoading: false,
      targetCurrency: 'EUR',
    };
    render(<PaymentTimelineCard payment={{ id: 'payment-3', label: 'Same', amount: 10 }} />);
    expect(screen.getByText('10-EUR-en-exact')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Frankfurter');
  });

  it('formats a fresh cross-currency conversion even when the source amount is absent', () => {
    mocks.conversionResult = {
      conversion: { convertedAmount: 10, rate: 1.1, rateDate: '2026-08-09', cacheStatus: 'fresh' },
      isLoading: false,
      targetCurrency: 'USD',
    };
    render(<PaymentTimelineCard payment={{ id: 'payment-fresh', label: 'Fresh' }} />);
    expect(screen.getByText('10-USD-en-approx')).toBeTruthy();
    expect(document.body.textContent).toContain('0-EUR-en-exact');
    expect(document.body.textContent).not.toContain('stale');
  });

  it('shows unavailable conversion only after loading and supports German stale text', () => {
    mocks.conversionResult = { conversion: null, isLoading: false, targetCurrency: 'USD' };
    render(<PaymentTimelineCard payment={{ id: 'payment-4', label: 'Unavailable', amount: 5 }} />);
    expect(screen.getByText('Conversion unavailable')).toBeTruthy();
    cleanup();

    mocks.conversionResult = { conversion: null, isLoading: true, targetCurrency: 'USD' };
    render(<PaymentTimelineCard payment={{ id: 'payment-5', label: 'Loading', amount: 5 }} />);
    expect(screen.queryByText('Conversion unavailable')).toBeNull();
    cleanup();

    mocks.language = 'de';
    mocks.conversionResult = {
      conversion: { convertedAmount: 6, rate: 1.2, rateDate: '2026-08-09', cacheStatus: 'stale' },
      isLoading: false,
      targetCurrency: 'USD',
    };
    render(<PaymentTimelineCard payment={{ id: 'payment-6', label: 'Alt', amount: 5 }} />);
    expect(document.body.textContent).toContain('veraltet');
  });

  it('omits invalid amounts and all optional display metadata', () => {
    render(
      <PaymentTimelineCard
        payment={{
          id: 'payment-7',
          label: 'Minimal',
          amount: Number.NaN,
          currency: null,
          direction: null,
          createdAt: 'invalid',
          groupId: null,
        }}
      />
    );
    expect(mocks.baseProps?.href).toBeUndefined();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
