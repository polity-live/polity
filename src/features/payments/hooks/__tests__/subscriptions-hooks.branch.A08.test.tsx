/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  commonState: vi.fn(),
  unsubscribe: vi.fn(),
  waitForClientApply: vi.fn((value: unknown) => value),
}));

vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: (...args: unknown[]) => mocks.commonState(...args),
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ unsubscribe: mocks.unsubscribe }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.waitForClientApply(value),
}));

import { useSubscriptionsFilters, type FilterType } from '../useSubscriptionsFilters';
import { useUserSubscriptions } from '../useUserSubscriptions';

const subscriptions = [
  { id: 'user', user: { first_name: 'Ada', last_name: 7 } },
  { id: 'group', group: { name: true, description: 'Civic group' } },
  { id: 'amendment', amendment: { title: 'Budget motion' } },
  { id: 'event', event: { title: 'Assembly', description: 'Berlin' } },
  { id: 'blog', blog: { title: 'Democracy' } },
  { id: 'unknown' },
] as never;

const subscribers = [
  { id: 'subscriber', subscriber_user: { first_name: 'Grace', last_name: 'Hopper' } },
  { id: 'anonymous', subscriber_user: null },
] as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.waitForClientApply.mockImplementation((value: unknown) => value);
});

afterEach(cleanup);

describe('useSubscriptionsFilters', () => {
  it('covers search normalization and every subscription entity', () => {
    const { result } = renderHook(() => useSubscriptionsFilters({ subscriptions, subscribers }));

    expect(result.current.filteredSubscriptions).toHaveLength(6);
    expect(result.current.filteredSubscribers).toHaveLength(2);
    expect(result.current.subscriptionCounts).toEqual({
      all: 6,
      users: 1,
      groups: 1,
      amendments: 1,
      events: 1,
      blogs: 1,
    });

    for (const [query, id] of [
      ['7', 'user'],
      ['true', 'group'],
      ['budget', 'amendment'],
      ['berlin', 'event'],
      ['democracy', 'blog'],
    ]) {
      act(() => result.current.setSearchQuery(query));
      expect(result.current.filteredSubscriptions.map(item => item.id)).toEqual([id]);
    }

    act(() => result.current.setSearchQuery('grace'));
    expect(result.current.filteredSubscribers.map(item => item.id)).toEqual(['subscriber']);
    act(() => result.current.setSearchQuery('missing'));
    expect(result.current.filteredSubscriptions).toEqual([]);
    expect(result.current.filteredSubscribers).toEqual([]);
  });

  it('filters all supported types and preserves results for a defensive unknown type', () => {
    const { result } = renderHook(() => useSubscriptionsFilters({ subscriptions, subscribers }));

    for (const [filter, id] of [
      ['users', 'user'],
      ['groups', 'group'],
      ['amendments', 'amendment'],
      ['events', 'event'],
      ['blogs', 'blog'],
    ] as const) {
      act(() => result.current.setFilterType(filter));
      expect(result.current.filteredSubscriptions.map(item => item.id)).toEqual([id]);
    }

    act(() => result.current.setFilterType('unsupported' as FilterType));
    expect(result.current.filteredSubscriptions).toHaveLength(6);
    act(() => result.current.setFilterType('all'));
    expect(result.current.filteredSubscriptions).toHaveLength(6);
  });
});

describe('useUserSubscriptions', () => {
  it('defaults missing rows and counts every populated entity', () => {
    mocks.commonState.mockReturnValue({ userSubscriptions: undefined, userSubscribers: undefined });
    const empty = renderHook(() => useUserSubscriptions('user-1'));
    expect(mocks.commonState).toHaveBeenCalledWith({
      subscriberId: 'user-1',
      subscriberUserId: 'user-1',
    });
    expect(empty.result.current.subscriptions).toEqual([]);
    expect(empty.result.current.subscribers).toEqual([]);
    empty.unmount();

    mocks.commonState.mockReturnValue({
      userSubscriptions: subscriptions,
      userSubscribers: subscribers,
    });
    const populated = renderHook(() => useUserSubscriptions());
    expect(populated.result.current.getSubscriptionCounts).toEqual({
      users: 1,
      groups: 1,
      amendments: 1,
      events: 1,
      blogs: 1,
      total: 6,
    });
  });

  it('returns deterministic success and failure results for both removal operations', async () => {
    mocks.commonState.mockReturnValue({ userSubscriptions: [], userSubscribers: [] });
    mocks.unsubscribe.mockImplementation(({ id }: { id: string }) =>
      id.startsWith('ok') ? Promise.resolve(id) : Promise.reject(new Error(id))
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useUserSubscriptions('user-1'));

    await expect(result.current.unsubscribe('ok-unsubscribe')).resolves.toEqual({ success: true });
    await expect(result.current.unsubscribe('bad-unsubscribe')).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    await expect(result.current.removeSubscriber('ok-remove')).resolves.toEqual({ success: true });
    await expect(result.current.removeSubscriber('bad-remove')).resolves.toMatchObject({
      success: false,
      error: expect.any(Error),
    });
    expect(consoleError).toHaveBeenCalledTimes(2);
  });
});
