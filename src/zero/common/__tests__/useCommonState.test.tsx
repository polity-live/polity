/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const results = new Map<string, unknown>();
  const statuses = new Map<string, string>();
  const calls: { key?: string; args?: unknown }[] = [];
  const common = new Proxy(
    {},
    {
      get: (_target, property: string) => (args: unknown) => ({
        key: `common.${property}`,
        args,
      }),
    }
  );
  return {
    results,
    statuses,
    calls,
    queries: { common },
    useQuery: vi.fn((query?: { key?: string; args?: unknown }) => {
      calls.push(query ?? {});
      return [
        query?.key ? results.get(query.key) : undefined,
        { type: query?.key ? (statuses.get(query.key) ?? 'complete') : 'complete' },
      ];
    }),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));
vi.mock('../../queries', () => ({ queries: mocks.queries }));

import { useCommonState } from '../useCommonState';

const allArgs = {
  entity_id: 'entity-1',
  entity_type: 'group',
  user_id: 'user-1',
  group_id: 'group-1',
  amendment_id: 'amendment-1',
  event_id: 'event-1',
  blog_id: 'blog-1',
  subscriberId: 'subscriber-1',
  subscriberIdForTimeline: 'subscriber-timeline-1',
  subscriberUserId: 'subscriber-user-1',
  timelineEntityIds: ['entity-1'],
  timelineContentTypes: ['event'],
  timelineContentLimit: 10,
  loadAllHashtags: true,
  loadOnboardingHashtagUsage: true,
};

beforeEach(() => {
  mocks.results.clear();
  mocks.statuses.clear();
  mocks.calls.length = 0;
  mocks.useQuery.mockClear();
});

describe('useCommonState query contract', () => {
  it('disables every query without required arguments', () => {
    expect(renderHook(() => useCommonState()).result.current).toEqual({
      subscribers: undefined,
      userHashtags: undefined,
      groupHashtags: undefined,
      amendmentHashtags: undefined,
      eventHashtags: undefined,
      blogHashtags: undefined,
      allHashtags: undefined,
      onboardingHashtagUsage: undefined,
      links: undefined,
      timeline: undefined,
      reactions: undefined,
      userSubscriptions: undefined,
      userSubscriptionsForTimeline: undefined,
      userSubscribers: undefined,
      timelineByEntityIds: undefined,
      timelineByContentTypes: undefined,
      isLoading: false,
    });
    expect(mocks.calls.every(call => call.key === undefined)).toBe(true);
  });

  it('returns all enabled query values and forwards limits', () => {
    const keys = [
      'subscribers',
      'userHashtags',
      'groupHashtags',
      'amendmentHashtags',
      'eventHashtags',
      'blogHashtags',
      'allHashtags',
      'onboardingHashtagUsage',
      'links',
      'timelineByEntity',
      'reactions',
      'userSubscriptions',
      'userSubscriptionsForTimeline',
      'userSubscribers',
      'timelineEventsByEntityIds',
      'timelineEventsByContentTypes',
    ];
    for (const key of keys) mocks.results.set(`common.${key}`, [{ id: key }]);
    const current = renderHook(() => useCommonState(allArgs)).result.current;
    expect(current.isLoading).toBe(false);
    expect(current.subscribers).toEqual([{ id: 'subscribers' }]);
    expect(current.timeline).toEqual([{ id: 'timelineByEntity' }]);
    expect(current.timelineByContentTypes).toEqual([{ id: 'timelineEventsByContentTypes' }]);
    expect(
      mocks.calls.find(call => call.key === 'common.timelineEventsByContentTypes')?.args
    ).toMatchObject({ limit: 10, content_types: ['event'] });
  });

  it('activates entity filters independently and includes the default content limit', () => {
    for (const field of ['user_id', 'group_id', 'amendment_id', 'event_id', 'blog_id'] as const) {
      mocks.calls.length = 0;
      renderHook(() => useCommonState({ [field]: `${field}-1` }));
      expect(mocks.calls.some(call => call.key === 'common.subscribers')).toBe(true);
    }

    mocks.calls.length = 0;
    renderHook(() => useCommonState({ timelineEntityIds: [], timelineContentTypes: [] }));
    expect(mocks.calls.every(call => call.key === undefined)).toBe(true);

    mocks.calls.length = 0;
    renderHook(() => useCommonState({ timelineContentTypes: ['blog'] }));
    expect(
      mocks.calls.find(call => call.key === 'common.timelineEventsByContentTypes')?.args
    ).toMatchObject({ limit: 50 });
  });

  it('requires both timeline entity fields', () => {
    renderHook(() => useCommonState({ entity_id: 'entity-1' }));
    expect(mocks.calls.every(call => call.key === undefined)).toBe(true);
    mocks.calls.length = 0;
    renderHook(() => useCommonState({ entity_type: 'group' }));
    expect(mocks.calls.every(call => call.key === undefined)).toBe(true);
  });

  it('reports each enabled query boundary independently as loading', () => {
    const boundaries = [
      'common.subscribers',
      'common.userHashtags',
      'common.groupHashtags',
      'common.amendmentHashtags',
      'common.eventHashtags',
      'common.blogHashtags',
      'common.allHashtags',
      'common.onboardingHashtagUsage',
      'common.links',
      'common.timelineByEntity',
      'common.reactions',
      'common.userSubscriptions',
      'common.userSubscriptionsForTimeline',
      'common.userSubscribers',
      'common.timelineEventsByEntityIds',
      'common.timelineEventsByContentTypes',
    ];
    for (const key of boundaries) {
      mocks.statuses.set(key, 'unknown');
      expect(renderHook(() => useCommonState(allArgs)).result.current.isLoading).toBe(true);
      mocks.statuses.delete(key);
    }
  });
});
