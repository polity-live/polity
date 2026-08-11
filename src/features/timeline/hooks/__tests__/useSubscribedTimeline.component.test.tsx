/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  sortSubscribedTimelineItems,
  useSubscribedTimeline,
  type TimelineItem,
} from '../useSubscribedTimeline';

let membershipRows: any;
let participationRows: any;
let membershipResultType = 'complete';
let participationResultType = 'complete';

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { kind: string }) =>
    query.kind === 'memberships'
      ? [membershipRows, { type: membershipResultType }]
      : [participationRows, { type: participationResultType }],
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    groups: { membershipPageByUser: () => ({ kind: 'memberships' }) },
    events: { participantPageByUser: () => ({ kind: 'participations' }) },
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

beforeEach(() => {
  membershipRows = [];
  participationRows = [];
  membershipResultType = 'complete';
  participationResultType = 'complete';
  vi.spyOn(Date, 'now').mockReturnValue(10_000);
});

describe('useSubscribedTimeline', () => {
  it('normalizes absent query data and both loading-result combinations', () => {
    membershipRows = null;
    participationRows = undefined;
    membershipResultType = 'unknown';
    let hook = renderHook(() => useSubscribedTimeline({ userId: 'user-1' }));
    expect(hook.result.current).toMatchObject({
      items: [],
      isLoading: true,
      subscribedGroupIds: [],
      hasMore: false,
      error: null,
    });
    act(() => {
      hook.result.current.loadMore();
      hook.result.current.refresh();
    });
    hook.unmount();

    membershipResultType = 'complete';
    participationResultType = 'unknown';
    hook = renderHook(() => useSubscribedTimeline({ userId: 'user-1' }));
    expect(hook.result.current.isLoading).toBe(true);
  });

  it('maps rich and sparse group/event rows, filters tags, and deduplicates IDs', () => {
    membershipRows = [
      { group: null },
      {
        group: {
          id: 'shared',
          name: '',
          description: 'Group description',
          image_url: null,
          latitude: null,
          longitude: null,
          member_count: 2,
          events: [{ id: 'event' }],
          amendments: [],
          created_at: 0,
          group_hashtags: [{ hashtag: { tag: 'group-tag' } }, { hashtag: null }],
        },
      },
      {
        group: {
          id: 'group-2',
          name: 'Named group',
          description: null,
          image_url: 'group.jpg',
          latitude: 1,
          longitude: 2,
          member_count: 0,
          events: null,
          amendments: null,
          created_at: 1_000,
          group_hashtags: null,
        },
      },
      { group: { id: '', name: 'Missing id', created_at: 2_000 } },
    ];
    participationRows = [
      { event: null },
      {
        event: {
          id: 'shared',
          title: 'Duplicate event',
          created_at: 9_000,
          agenda_items: [],
        },
      },
      {
        event: {
          id: 'event-2',
          title: '',
          description: 'Event description',
          image_url: null,
          group_id: null,
          start_date: 2_000,
          end_date: 3_000,
          location_name: null,
          latitude: null,
          longitude: null,
          participants: [{ id: 'participant' }],
          agenda_items: [{ election: { id: 'election' } }, { election: null }],
          created_at: 0,
          status: null,
          event_hashtags: [{ hashtag: { tag: 'event-tag' } }, { hashtag: { tag: '' } }],
          is_recurring: 1,
          recurrence_pattern: null,
        },
      },
      {
        event: {
          id: 'event-3',
          title: 'Named event',
          description: null,
          image_url: 'event.jpg',
          group_id: 'group-2',
          start_date: 0,
          end_date: 0,
          location_name: 'Hall',
          latitude: 1,
          longitude: 2,
          participants: null,
          agenda_items: null,
          created_at: 5_000,
          status: 'open',
          event_hashtags: null,
          is_recurring: 0,
          recurrence_pattern: 'weekly',
        },
      },
    ];

    const { result } = renderHook(() =>
      useSubscribedTimeline({ userId: 'user-1', pageSize: 5, contentTypes: ['event'] })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.subscribedGroupIds).toEqual(['shared', 'group-2']);
    expect(result.current.items.map(item => item.id)).toEqual([
      'shared',
      'event-2',
      'event-3',
      '',
      'group-2',
    ]);
    expect(result.current.items.find(item => item.id === 'shared')).toMatchObject({
      title: 'features.timeline.fallbacks.unnamedGroup',
      tags: ['group-tag'],
    });
    expect(result.current.items.find(item => item.id === 'event-2')).toMatchObject({
      title: 'features.timeline.fallbacks.unnamedEvent',
      electionsCount: 1,
      attendeeCount: 1,
      tags: ['event-tag'],
      isRecurring: true,
    });
  });
});

describe('sortSubscribedTimelineItems', () => {
  function item(id: string, createdAt: number, stats?: TimelineItem['stats']): TimelineItem {
    return { id, type: 'event', title: id, createdAt: new Date(createdAt), stats };
  }

  it('sorts by recent time and uses the default branch for unexpected modes', () => {
    expect(sortSubscribedTimelineItems([item('old', 1), item('new', 2)], 'recent')[0]?.id).toBe(
      'new'
    );
    expect(
      sortSubscribedTimelineItems([item('old', 1), item('new', 2)], 'unexpected' as any)[0]?.id
    ).toBe('new');
  });

  it('sorts popularity with present and absent reaction/comment counts', () => {
    const sorted = sortSubscribedTimelineItems(
      [
        item('none', 1),
        item('comments', 1, { comments: 3, reactions: 0 }),
        item('reactions', 1, { comments: 0, reactions: 5 }),
      ],
      'popular'
    );
    expect(sorted.map(entry => entry.id)).toEqual(['reactions', 'comments', 'none']);
  });

  it('sorts trending engagement across sub-hour and older age floors', () => {
    const now = Date.now();
    const sorted = sortSubscribedTimelineItems(
      [
        item('old', now - 7_200_000, { reactions: 4 }),
        item('fresh', now - 500, { reactions: 3 }),
        item('none', now - 1_000),
      ],
      'trending'
    );
    expect(sorted.map(entry => entry.id)).toEqual(['fresh', 'old', 'none']);

    expect(
      sortSubscribedTimelineItems(
        [
          item('comment-only', now - 1_000, { comments: 2 }),
          item('reaction', now - 1_000, { reactions: 1 }),
        ],
        'trending'
      ).map(entry => entry.id)
    ).toEqual(['reaction', 'comment-only']);
  });
});
