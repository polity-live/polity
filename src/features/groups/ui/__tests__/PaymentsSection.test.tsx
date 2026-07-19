/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('@/features/pql/hooks/usePqlCollection', () => ({
  usePqlCollection: () => ({
    searchQuery: '',
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
    filteredItems: [],
    hasActiveFilters: false,
  }),
}));

vi.mock('@/features/pql/ui/PqlToolbar', () => ({
  PqlToolbar: () => <div data-testid="pql-toolbar" />,
}));

vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: 'EUR' }),
}));

import { PaymentsSection } from '../PaymentsSection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  groupId: 'group-1',
  storageKey: 'payments-test',
  payments: [],
  summary: { income: 0, expenditure: 0, balance: 0 },
  incomeData: [],
  expenditureData: [],
};

describe('PaymentsSection', () => {
  it('hides payment creation buttons without manage rights', () => {
    render(<PaymentsSection {...baseProps} canManagePayments={false} />);

    expect(screen.queryByText('Add Income')).toBeNull();
    expect(screen.queryByText('Add Expense')).toBeNull();
  });

  it('shows payment creation buttons with manage rights', () => {
    render(<PaymentsSection {...baseProps} canManagePayments />);

    expect(screen.queryByText('Add Income')).not.toBeNull();
    expect(screen.queryByText('Add Expense')).not.toBeNull();
  });
});
