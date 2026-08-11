/* @vitest-environment jsdom */

import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: null as any,
  displayCurrency: 'EUR',
  pqlInput: null as any,
  summary: { income: 1, expenditure: 1, balance: 0 },
  conversion: {
    conversions: {},
    convertiblePayments: [],
    missingPayments: [],
    missingOriginalTotals: {},
    isLoading: false,
  } as any,
}));

vi.mock('../PaymentsSectionView', () => ({
  PaymentsSectionView: (props: any) => {
    mocks.viewProps = props;
    return <div />;
  },
}));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: mocks.displayCurrency }),
}));
vi.mock('../../hooks/usePaymentConversions', () => ({
  usePaymentConversions: () => mocks.conversion,
}));
vi.mock('../../hooks/useFinancialData', () => ({
  useFinancialData: () => ({
    summary: mocks.summary,
    incomeData: ['income'],
    expenditureData: ['expense'],
  }),
}));
vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: (input: any) => {
    mocks.pqlInput = input;
    return {
      searchQuery: 'search',
      setSearchQuery: vi.fn(),
      quickFilterValues: {},
      setQuickFilterValues: vi.fn(),
      toggleQuickFilterValue: vi.fn(),
      clearQuickFilter: vi.fn(),
      savedFilters: [],
      saveCustomFilter: vi.fn(),
      deleteCustomFilter: vi.fn(),
      activeCustomFilterIds: [],
      toggleCustomFilter: vi.fn(),
      filteredItems: input.items,
      hasActiveFilters: false,
    };
  },
}));
vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme:${key}`,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { PaymentsSection, paymentsSectionInternals as helpers } from '../PaymentsSection';

const incoming = (overrides: Record<string, any> = {}) => ({
  id: 'income',
  label: 'Income',
  type: 'donation',
  amount: 10,
  currency: 'EUR',
  created_at: 2,
  receiver_group_id: 'group',
  payer_user: null,
  payer_group: null,
  ...overrides,
});
const outgoing = (overrides: Record<string, any> = {}) => ({
  id: 'expense',
  label: 'Expense',
  type: 'others',
  amount: 5,
  currency: null,
  created_at: 1,
  receiver_group_id: 'other',
  receiver_user: null,
  receiver_group: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewProps = null;
  mocks.displayCurrency = 'EUR';
  mocks.summary = { income: 1, expenditure: 1, balance: 0 };
});

describe('payment section helpers', () => {
  it('labels types, directions, people, groups, counterparties, and chronological order', () => {
    expect(helpers.getPaymentTypeLabel('donation')).toContain('donation');
    expect(helpers.getPaymentTypeLabel('unknown-type')).toContain('unknown');
    expect(helpers.getPaymentDirection(incoming() as any, 'group')).toBe('income');
    expect(helpers.getPaymentDirection(outgoing() as any, 'group')).toBe('expense');
    expect(helpers.getUserLabel(null as any)).toBeNull();
    expect(helpers.getUserLabel({ id: 'id', first_name: 'First', last_name: 'Last' } as any)).toBe(
      'First Last'
    );
    expect(helpers.getUserLabel({ id: 'id', handle: 'handle' } as any)).toBe('handle');
    expect(helpers.getUserLabel({ id: 'id', email: 'mail' } as any)).toBe('mail');
    expect(helpers.getUserLabel({ id: 'id' } as any)).toBe('id');
    expect(helpers.getGroupLabel(null as any)).toBeNull();
    expect(helpers.getGroupLabel({ id: 'id', name: 'Name' } as any)).toBe('Name');
    expect(helpers.getGroupLabel({ id: 'id', name: '' } as any)).toBe('id');

    const cases = [
      [incoming({ payer_user: { id: 'payer', first_name: 'Payer' } }), 'user:payer', 'Payer'],
      [
        incoming({ payer_group: { id: 'payer-group', name: 'Payer Group' } }),
        'group:payer-group',
        'Payer Group',
      ],
      [incoming(), null, 'common.unknown'],
      [
        outgoing({ receiver_user: { id: 'receiver', handle: 'Receiver' } }),
        'user:receiver',
        'Receiver',
      ],
      [
        outgoing({ receiver_group: { id: 'receiver-group', name: 'Receiver Group' } }),
        'group:receiver-group',
        'Receiver Group',
      ],
      [outgoing(), null, 'common.unknown'],
    ] as const;
    for (const [payment, key, label] of cases) {
      expect(helpers.getCounterpartyKey(payment as any, 'group')).toBe(key);
      expect(helpers.getCounterpartyLabel(payment as any, 'group')).toBe(label);
    }
    expect(
      helpers.sortPayments([outgoing(), incoming()] as any).map(payment => payment.id)
    ).toEqual(['income', 'expense']);
  });
});

describe('PaymentsSection controller', () => {
  const payments = [
    incoming({ payer_user: { id: 'user', first_name: 'Zed', handle: 'zed', email: 'z@x' } }),
    incoming({
      id: 'group-income',
      payer_group: { id: 'payer-group', name: 'Alpha' },
      currency: 'USD',
    }),
    incoming({ id: 'no-party' }),
    outgoing({ receiver_user: { id: 'receiver', first_name: 'Beta', email: 'b@x' } }),
    outgoing({ id: 'group-expense', receiver_group: { id: 'receiver-group', name: 'Gamma' } }),
  ] as any[];

  it('builds PQL fields, options, searches, and neutral balance output', () => {
    render(
      <PaymentsSection
        groupId="group"
        storageKey="key"
        payments={payments}
        summary={{} as any}
        incomeData={[]}
        expenditureData={[]}
      />
    );
    expect(mocks.viewProps.canManagePayments).toBe(true);
    expect(mocks.viewProps.counterpartyOptions.map((option: any) => option.label)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Zed',
    ]);
    expect(mocks.viewProps.balanceClass).toBe('text-muted-foreground');
    expect(mocks.viewProps.targetCurrency).toBe('EUR');
    expect(mocks.viewProps.quickFilters).toHaveLength(3);
    for (const field of mocks.viewProps.fields) {
      for (const payment of payments) field.getValue(payment);
    }
    expect(mocks.pqlInput.searchValues[0](payments[0])).toEqual(expect.arrayContaining(['Income']));
    expect(mocks.pqlInput.sortItems([payments[1], payments[0]])).toHaveLength(2);
  });

  it('selects positive and negative balance themes and follows preference changes', () => {
    mocks.summary = { income: 2, expenditure: 1, balance: 1 };
    const rendered = render(
      <PaymentsSection
        groupId="group"
        storageKey="key"
        payments={[]}
        summary={{} as any}
        incomeData={[]}
        expenditureData={[]}
        canManagePayments={false}
      />
    );
    expect(mocks.viewProps.balanceClass).toContain('Success');
    act(() => mocks.viewProps.setTargetCurrency('GBP'));
    expect(mocks.viewProps.targetCurrency).toBe('GBP');
    mocks.displayCurrency = 'USD';
    rendered.rerender(
      <PaymentsSection
        groupId="group"
        storageKey="key"
        payments={[]}
        summary={{} as any}
        incomeData={[]}
        expenditureData={[]}
        canManagePayments={false}
      />
    );
    expect(mocks.viewProps.targetCurrency).toBe('USD');

    mocks.summary = { income: 1, expenditure: 2, balance: -1 };
    rendered.rerender(
      <PaymentsSection
        groupId="group"
        storageKey="key"
        payments={[]}
        summary={{} as any}
        incomeData={[]}
        expenditureData={[]}
      />
    );
    expect(mocks.viewProps.balanceClass).toContain('Danger');
  });
});
