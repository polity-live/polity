import { useState, useMemo } from 'react';
import { useCommonState } from '@/zero/common/useCommonState';

export type FilterType = 'all' | 'users' | 'groups' | 'amendments' | 'events' | 'blogs';

type SubscriptionItem = NonNullable<ReturnType<typeof useCommonState>['userSubscriptions']>[number];
type SubscriberItem = NonNullable<ReturnType<typeof useCommonState>['userSubscribers']>[number];

function toSearchTextPart(part: unknown): string | null {
  if (typeof part === 'string') {
    return part;
  }

  if (typeof part === 'number' || typeof part === 'boolean') {
    return String(part);
  }

  return null;
}

function createSearchText(parts: unknown[]) {
  return parts
    .map(toSearchTextPart)
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

export interface UseSubscriptionsFiltersOptions {
  subscriptions: SubscriptionItem[];
  subscribers: SubscriberItem[];
}

export interface SubscriptionCounts {
  all: number;
  users: number;
  groups: number;
  amendments: number;
  events: number;
  blogs: number;
}

export interface UseSubscriptionsFiltersReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  filteredSubscriptions: SubscriptionItem[];
  filteredSubscribers: SubscriberItem[];
  subscriptionCounts: SubscriptionCounts;
}

export function useSubscriptionsFilters({
  subscriptions,
  subscribers,
}: UseSubscriptionsFiltersOptions): UseSubscriptionsFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const searchFilteredSubscriptions = useMemo(() => {
    if (!searchQuery.trim()) return subscriptions;

    const query = searchQuery.trim().toLowerCase();
    return subscriptions.filter(subscription => {
      if (subscription.user) {
        return createSearchText([
          subscription.user.first_name,
          subscription.user.last_name,
        ]).includes(query);
      }

      if (subscription.group) {
        return createSearchText([subscription.group.name, subscription.group.description]).includes(
          query
        );
      }

      if (subscription.amendment) {
        return createSearchText([subscription.amendment.title]).includes(query);
      }

      if (subscription.event) {
        return createSearchText([
          subscription.event.title,
          subscription.event.description,
        ]).includes(query);
      }

      if (subscription.blog) {
        return createSearchText([subscription.blog.title]).includes(query);
      }

      return false;
    });
  }, [subscriptions, searchQuery]);

  const filteredSubscriptions = useMemo(() => {
    if (filterType === 'all') {
      return searchFilteredSubscriptions;
    }

    return searchFilteredSubscriptions.filter(subscription => {
      switch (filterType) {
        case 'users':
          return !!subscription.user;
        case 'groups':
          return !!subscription.group;
        case 'amendments':
          return !!subscription.amendment;
        case 'events':
          return !!subscription.event;
        case 'blogs':
          return !!subscription.blog;
        default:
          return true;
      }
    });
  }, [searchFilteredSubscriptions, filterType]);

  const filteredSubscribers = useMemo(() => {
    if (!searchQuery.trim()) return subscribers;

    const query = searchQuery.trim().toLowerCase();
    return subscribers.filter(subscription =>
      createSearchText([
        subscription.subscriber_user?.first_name,
        subscription.subscriber_user?.last_name,
      ]).includes(query)
    );
  }, [subscribers, searchQuery]);

  const subscriptionCounts: SubscriptionCounts = useMemo(() => {
    return {
      all: searchFilteredSubscriptions.length,
      users: searchFilteredSubscriptions.filter(subscription => !!subscription.user).length,
      groups: searchFilteredSubscriptions.filter(subscription => !!subscription.group).length,
      amendments: searchFilteredSubscriptions.filter(subscription => !!subscription.amendment)
        .length,
      events: searchFilteredSubscriptions.filter(subscription => !!subscription.event).length,
      blogs: searchFilteredSubscriptions.filter(subscription => !!subscription.blog).length,
    };
  }, [searchFilteredSubscriptions]);

  return {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filteredSubscriptions,
    filteredSubscribers,
    subscriptionCounts,
  };
}
