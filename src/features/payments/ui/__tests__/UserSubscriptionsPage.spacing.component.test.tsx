/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const useUserSubscriptionsMock = vi.fn();
const useSubscriptionsFiltersMock = vi.fn();

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/payments/hooks/useUserSubscriptions', () => ({
  useUserSubscriptions: (...args: unknown[]) => useUserSubscriptionsMock(...args),
}));

vi.mock('@/features/payments/hooks/useSubscriptionsFilters', () => ({
  useSubscriptionsFilters: (...args: unknown[]) => useSubscriptionsFiltersMock(...args),
}));

vi.mock('@/features/payments/ui/SubscriptionTypeFilters', () => ({
  SubscriptionTypeFilters: () => <div data-testid="subscription-type-filters" />,
}));

vi.mock('@/features/payments/ui/SubscriptionsTable', () => ({
  SubscriptionsTable: () => <div data-testid="subscriptions-table" />,
}));

vi.mock('@/features/shared/ui/ui/entity-search-bar', () => ({
  EntitySearchBar: () => <div data-testid="entity-search-bar" />,
}));

import { Route } from '../../../../routes/_authed/user/$id/subscriptions';

const UserSubscriptionsPage =
  Route.options.component ??
  (() => {
    throw new Error('User subscriptions route component is missing.');
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('UserSubscriptionsPage spacing', () => {
  it('keeps the hidden heading outside the visible content stack', () => {
    vi.spyOn(Route, 'useParams').mockReturnValue({ id: 'user-1' } as never);
    useUserSubscriptionsMock.mockReturnValue({
      subscriptions: [],
      subscribers: [],
      unsubscribe: vi.fn(),
    });
    useSubscriptionsFiltersMock.mockReturnValue({
      searchQuery: '',
      setSearchQuery: vi.fn(),
      filterType: 'all',
      setFilterType: vi.fn(),
      filteredSubscriptions: [],
      subscriptionCounts: {},
    });

    const { container } = render(<UserSubscriptionsPage />);
    const heading = container.querySelector('h1.sr-only');
    const visibleContent = heading?.nextElementSibling;

    expect(visibleContent?.className).toContain('space-y-6');
    expect(visibleContent?.contains(heading ?? null)).toBe(false);
  });
});
