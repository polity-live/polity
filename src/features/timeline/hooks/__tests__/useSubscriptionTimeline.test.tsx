/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubscriptionTimeline } from '../useSubscriptionTimeline';

let authUser: { id: string } | null;
let subscriptions: any;
let timelineRows: any;
let subscriptionResultType: string;
let timelineResultType: string;

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/zero/queries', () => ({
  queries: {
    common: {
      subscriptionPage: () => ({ kind: 'subscriptions' }),
      timelineFeedPage: (args: unknown) => ({ kind: 'timeline', args }),
    },
  },
}));
vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { kind?: string } | null) =>
    query?.kind === 'subscriptions'
      ? [subscriptions, { type: subscriptionResultType }]
      : query?.kind === 'timeline'
        ? [timelineRows, { type: timelineResultType }]
        : [undefined, { type: 'complete' }],
}));

beforeEach(() => {
  authUser = { id: 'user-1' };
  subscriptions = [];
  timelineRows = [];
  subscriptionResultType = 'complete';
  timelineResultType = 'complete';
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('useSubscriptionTimeline', () => {
  it('does not query or load a timeline for anonymous users', () => {
    authUser = null;
    subscriptions = null;
    timelineRows = null;
    const { result } = renderHook(() => useSubscriptionTimeline());
    expect(result.current).toEqual({
      events: [],
      isLoading: false,
      subscribedEntityIds: { users: [], groups: [], amendments: [], events: [], blogs: [] },
    });
  });

  it('collects every subscribed entity kind and sorts nullable timestamps descending', () => {
    subscriptions = [
      { user: { id: 'user-2' } },
      { user: null, group: { id: 'group-1' } },
      { amendment: { id: 'amendment-1' } },
      { event: { id: 'event-1' } },
      { blog: { id: 'blog-1' } },
      {},
    ];
    timelineRows = [
      { id: 'old', created_at: null },
      { id: 'new', created_at: 20 },
      { id: 'middle', created_at: 10 },
    ];
    const { result } = renderHook(() => useSubscriptionTimeline());
    expect(result.current.subscribedEntityIds).toEqual({
      users: ['user-2'],
      groups: ['group-1'],
      amendments: ['amendment-1'],
      events: ['event-1'],
      blogs: ['blog-1'],
    });
    expect(result.current.events.map(event => event.id)).toEqual(['new', 'middle', 'old']);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports subscription and timeline loading independently', () => {
    subscriptionResultType = 'unknown';
    let hook = renderHook(() => useSubscriptionTimeline());
    expect(hook.result.current.isLoading).toBe(true);
    hook.unmount();

    subscriptions = [{ event: { id: 'event-1' } }];
    subscriptionResultType = 'complete';
    timelineResultType = 'unknown';
    hook = renderHook(() => useSubscriptionTimeline());
    expect(hook.result.current.isLoading).toBe(true);
  });

  it('sorts rows whose newer comparator counterpart has no timestamp', () => {
    subscriptions = [{ event: { id: 'event-1' } }];
    timelineRows = [
      { id: 'without-time', created_at: undefined },
      { id: 'with-time', created_at: 1 },
      { id: 'also-without-time', created_at: null },
    ];

    const { result } = renderHook(() => useSubscriptionTimeline());
    expect(result.current.events[0]?.id).toBe('with-time');
  });
});
