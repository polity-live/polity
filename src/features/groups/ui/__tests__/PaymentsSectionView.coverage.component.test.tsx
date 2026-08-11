/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'de',
  tooltipFormatters: [] as ((value: unknown) => unknown)[],
  currencyCalls: [] as any[],
  pqlProps: null as any,
  currencyProps: null as any,
}));

vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock('lucide-react', () => ({ Plus: () => <span /> }));
vi.mock('@/features/shared/ui/charting', () => ({
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <span data-testid="cell" />,
  RechartsTooltip: ({ formatter }: any) => {
    mocks.tooltipFormatters.push(formatter);
    return <span />;
  },
  Legend: () => <span />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  StatusBadge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/pql/ui/PqlToolbar', () => ({
  PqlToolbar: (props: any) => {
    mocks.pqlProps = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: mocks.language, t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form/CurrencySelect', () => ({
  CurrencySelect: (props: any) => {
    mocks.currencyProps = props;
    return <div />;
  },
}));
vi.mock('@/features/shared/logic/currency', () => ({
  formatCurrencyMajor: (amount: number, currency: string, language: string, options?: any) => {
    mocks.currencyCalls.push({ amount, currency, language, options });
    return `${currency}:${amount}${options?.approximate ? '~' : ''}`;
  },
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme:${key}`,
}));

import { PaymentsSectionView, type PaymentsSectionViewProps } from '../PaymentsSectionView';

function props(overrides: Partial<PaymentsSectionViewProps> = {}): PaymentsSectionViewProps {
  const fn = vi.fn();
  return {
    canManagePayments: false,
    groupId: 'group',
    storageKey: 'key',
    payments: [],
    summary: { income: 0, expenditure: 0, balance: 0 },
    incomeData: [],
    expenditureData: [],
    counterpartyOptions: [],
    fields: [],
    quickFilters: [],
    searchQuery: '',
    setSearchQuery: fn,
    quickFilterValues: {},
    setQuickFilterValues: fn,
    toggleQuickFilterValue: fn,
    clearQuickFilter: fn,
    savedFilters: [],
    saveCustomFilter: fn,
    deleteCustomFilter: fn,
    activeCustomFilterIds: [],
    toggleCustomFilter: fn,
    filteredItems: [],
    hasActiveFilters: false,
    balanceClass: 'balance',
    targetCurrency: 'EUR',
    setTargetCurrency: fn,
    conversionState: {
      conversions: {},
      missingPayments: [],
      missingOriginalTotals: {},
      isLoading: false,
    },
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.language = 'de';
  mocks.tooltipFormatters = [];
  mocks.currencyCalls = [];
  mocks.pqlProps = null;
  mocks.currencyProps = null;
});

describe('PaymentsSectionView', () => {
  it('renders loading, missing conversions, empty charts, and both empty-list labels', () => {
    const base = props({
      conversionState: {
        conversions: {},
        missingPayments: [{ id: 'missing' }],
        missingOriginalTotals: { USD: 10, GBP: 20 },
        isLoading: true,
      },
    });
    const rendered = render(<PaymentsSectionView {...base} />);
    expect(screen.getByText('Wechselkurse werden geladen …')).toBeTruthy();
    expect(
      screen.getByText('generated.inline.0105_no_payments_recorded_yet_15fc7dc7')
    ).toBeTruthy();
    expect(screen.getAllByText(/no_income|no_expenditure/i)).toHaveLength(2);
    expect(mocks.currencyProps).toMatchObject({ value: 'EUR' });
    expect(mocks.pqlProps).toMatchObject({ searchQuery: '' });

    rendered.rerender(<PaymentsSectionView {...base} hasActiveFilters />);
    expect(
      screen.getByText(
        'generated.inline.0104_no_payments_match_the_current_search_and_filt_337a7d4e'
      )
    ).toBeTruthy();
    mocks.language = 'en';
    rendered.rerender(<PaymentsSectionView {...base} />);
    expect(screen.getByText('Loading exchange rates…')).toBeTruthy();
  });

  it('renders charts and every income/expense counterparty and conversion state', () => {
    const payments = [
      {
        id: 'income-user',
        label: 'Income user',
        type: 'donation',
        amount: 10,
        currency: 'USD',
        created_at: 1,
        receiver_group_id: 'group',
        payer_user: { id: 'u1', first_name: 'First', last_name: 'Last' },
      },
      {
        id: 'income-handle',
        label: '',
        type: 'unknown',
        amount: 11,
        currency: 'EUR',
        created_at: 2,
        receiver_group_id: 'group',
        payer_user: { id: 'u2', handle: 'handle' },
      },
      {
        id: 'income-email',
        label: 'Email',
        type: 'others',
        amount: 12,
        currency: 'USD',
        created_at: 3,
        receiver_group_id: 'group',
        payer_user: { id: 'u3', email: 'mail' },
      },
      {
        id: 'income-id',
        label: 'Id',
        type: 'others',
        amount: 13,
        currency: 'USD',
        created_at: 4,
        receiver_group_id: 'group',
        payer_user: { id: 'u4' },
      },
      {
        id: 'income-group',
        label: 'Group',
        type: 'others',
        amount: 14,
        currency: 'USD',
        created_at: 5,
        receiver_group_id: 'group',
        payer_group: { id: 'g1', name: 'Group Name' },
      },
      {
        id: 'income-unknown',
        label: 'Unknown',
        type: 'others',
        amount: null,
        currency: null,
        created_at: 6,
        receiver_group_id: 'group',
      },
      {
        id: 'expense-user',
        label: 'Expense',
        type: 'others',
        amount: 15,
        currency: 'GBP',
        created_at: 7,
        receiver_group_id: 'other',
        receiver_user: { id: 'u5', first_name: 'Receiver' },
      },
      {
        id: 'expense-group',
        label: 'Expense group',
        type: 'others',
        amount: 16,
        currency: 'USD',
        created_at: 8,
        receiver_group_id: 'other',
        receiver_group: { id: 'g2', name: '' },
      },
      {
        id: 'expense-unknown',
        label: 'Expense unknown',
        type: 'others',
        amount: 17,
        currency: 'USD',
        created_at: 9,
        receiver_group_id: 'other',
      },
    ];
    const conversion = (baseCurrency: string, cacheStatus = 'fresh') => ({
      convertedAmount: 20,
      baseCurrency,
      quoteCurrency: 'EUR',
      requestedDate: '2026-01-01',
      rateDate: '2026-01-01',
      rate: 2,
      source: 'frankfurter',
      cacheStatus,
    });
    const conversionState = {
      conversions: {
        'income-user': conversion('USD', 'stale'),
        'income-handle': conversion('EUR'),
        'expense-user': conversion('GBP'),
        'expense-group': conversion('USD'),
      },
      missingPayments: [],
      missingOriginalTotals: {},
      isLoading: false,
    };
    render(
      <PaymentsSectionView
        {...props({
          canManagePayments: true,
          payments,
          filteredItems: payments,
          summary: { income: 100, expenditure: 50, balance: 50 },
          incomeData: [{ name: 'income', value: 1, fill: 'green' }],
          expenditureData: [{ name: 'expense', value: 1, fill: 'red' }],
          conversionState: conversionState as any,
        })}
      />
    );
    expect(screen.getAllByTestId('cell')).toHaveLength(2);
    expect(screen.getByText('First Last')).toBeTruthy();
    expect(screen.getByText('handle')).toBeTruthy();
    expect(screen.getByText('mail')).toBeTruthy();
    expect(screen.getByText('u4')).toBeTruthy();
    expect(screen.getByText('Group Name')).toBeTruthy();
    expect(screen.getByText('features.groups.paymentDialog.unknownPayer')).toBeTruthy();
    expect(screen.getByText('Receiver')).toBeTruthy();
    expect(screen.getByText('g2')).toBeTruthy();
    expect(screen.getByText('features.groups.paymentDialog.unknownReceiver')).toBeTruthy();
    expect(screen.getAllByText('pages.create.payment.conversionUnavailable')).toHaveLength(5);
    for (const formatter of mocks.tooltipFormatters) {
      expect(formatter('12')).toEqual(['EUR:12~', 'pages.create.payment.amount']);
    }
    expect(mocks.currencyCalls.some(call => call.options?.approximate === true)).toBe(true);
  });

  it('suppresses unavailable conversion while loading and localizes a stale English quote', () => {
    mocks.language = 'en';
    const payment = {
      id: 'stale',
      label: 'Stale',
      type: 'donation',
      amount: 1,
      currency: 'USD',
      created_at: 1,
      receiver_group_id: 'group',
    };
    const conversion: any = {
      originalAmount: 1,
      convertedAmount: 2,
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      requestedDate: '2026-01-01',
      rateDate: '2026-01-01',
      rate: 2,
      source: 'frankfurter',
      cacheStatus: 'stale',
    };
    const rendered = render(
      <PaymentsSectionView
        {...props({
          payments: [payment],
          filteredItems: [payment],
          conversionState: {
            conversions: { stale: conversion },
            missingPayments: [],
            missingOriginalTotals: {},
            isLoading: false,
          },
        })}
      />
    );
    expect(screen.getByText(/stale/)).toBeTruthy();
    rendered.rerender(
      <PaymentsSectionView
        {...props({
          payments: [{ ...payment, id: 'loading' }],
          filteredItems: [{ ...payment, id: 'loading' }],
          conversionState: {
            conversions: {},
            missingPayments: [],
            missingOriginalTotals: {},
            isLoading: true,
          },
        })}
      />
    );
    expect(screen.queryByText('pages.create.payment.conversionUnavailable')).toBeNull();
  });
});
