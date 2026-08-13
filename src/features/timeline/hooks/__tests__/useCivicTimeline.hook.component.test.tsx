/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', latitude: 52.52, longitude: 13.405 } as any,
  userLoading: false,
  interestTags: ['civic'] as string[],
  subscribed: { items: [] as any[], isLoading: false },
  subscription: { events: [] as any[], isLoading: false },
  agenda: { agendaItems: [] as any[], isLoading: false },
  agendaCalls: [] as { ids: string[] | undefined; settled: boolean }[],
  discoverRows: [] as any[] | null,
  discoverResult: { type: 'complete' } as { type: string },
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [mocks.discoverRows, mocks.discoverResult],
}));

vi.mock('@/zero/users/useUserBasicState', () => ({
  useUserBasicState: () => ({ user: mocks.user, isLoading: mocks.userLoading }),
}));

vi.mock('@/zero/common/useUserHashtagsState', () => ({
  useUserHashtagsState: () => ({ userHashtags: [] }),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: () => mocks.interestTags,
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaTimelineState: (ids: string[] | undefined, settled: boolean) => {
    mocks.agendaCalls.push({ ids, settled });
    return mocks.agenda;
  },
}));

vi.mock('../useSubscribedTimeline', () => ({
  useSubscribedTimeline: () => mocks.subscribed,
}));

vi.mock('../useSubscriptionTimeline', () => ({
  useSubscriptionTimeline: () => mocks.subscription,
}));

import { useCivicTimeline, type UseCivicTimelineOptions } from '../useCivicTimeline';

const filters = {
  contentTypes: [
    'group',
    'event',
    'amendment',
    'agenda_item',
    'vote',
    'election',
    'statement',
    'blog',
    'workflow',
    'user',
  ],
  dateRange: 'all',
  topics: [],
  engagement: 'all',
} as any;

function options(overrides: Partial<UseCivicTimelineOptions> = {}): UseCivicTimelineOptions {
  return {
    userId: 'user-1',
    userEmail: 'person@example.com',
    filters,
    radiusKm: 'all',
    decisions: [],
    ...overrides,
  };
}

function resetMocks() {
  mocks.user = { id: 'user-1', latitude: 52.52, longitude: 13.405 };
  mocks.userLoading = false;
  mocks.interestTags = ['civic'];
  mocks.subscribed = { items: [], isLoading: false };
  mocks.subscription = { events: [], isLoading: false };
  mocks.agenda = { agendaItems: [], isLoading: false };
  mocks.agendaCalls = [];
  mocks.discoverRows = [];
  mocks.discoverResult = { type: 'complete' };
}

afterEach(() => resetMocks());

function subscribed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'subscribed-1',
    entityId: 'shared-entity',
    eventId: 'event-b',
    type: 'event',
    title: 'Subscribed event',
    createdAt: new Date(),
    latitude: 52.52,
    longitude: 13.405,
    attendeeCount: 2,
    tags: ['subscribed-topic'],
    ...overrides,
  } as any;
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-feed-1',
    entity_id: 'shared-entity',
    content_type: 'event',
    title: 'Feed event',
    created_at: Date.now(),
    event: { id: 'event-a', title: 'Feed event', latitude: 52.52, longitude: 13.405 },
    group: null,
    user: null,
    tags: ['feed-topic'],
    ...overrides,
  } as any;
}

function agendaItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agenda-1',
    title: 'Agenda item',
    description: null,
    type: 'vote',
    status: 'planned',
    duration: 30,
    start_time: null,
    end_time: null,
    activated_at: null,
    completed_at: null,
    calculated_start_time: Date.now() + 60_000,
    calculated_end_time: Date.now() + 120_000,
    created_at: Date.now(),
    event: {
      id: 'event-c',
      title: 'Assembly',
      latitude: null,
      longitude: null,
      location_name: null,
    },
    ...overrides,
  } as any;
}

describe('useCivicTimeline orchestration', () => {
  it('combines settled sources, removes duplicates, and derives map and topic output', () => {
    mocks.subscribed = {
      isLoading: false,
      items: [
        subscribed(),
        subscribed({ id: 'without-event', entityId: 'other', eventId: undefined, tags: undefined }),
        subscribed({ id: 'unsupported', type: 'video' }),
      ],
    };
    mocks.subscription = {
      isLoading: false,
      events: [
        event(),
        event({ id: 'no-event', entity_id: 'workflow-1', content_type: 'workflow', event: null }),
        event({ id: 'unsupported', content_type: 'video', event: null }),
      ],
    };
    mocks.agenda = {
      isLoading: false,
      agendaItems: [agendaItem(), agendaItem({ id: 'invalid-agenda', event: null })],
    };
    mocks.discoverRows = [
      {
        id: 'discover-1',
        entity_id: 'discover-event',
        entity_type: 'event',
        title: 'Nearby discovery',
        subtitle: 'Nearby',
        created_at: Date.now(),
        card_payload: {
          latitude: 52.52,
          longitude: 13.405,
          tags: ['civic', 'discover-topic'],
        },
      },
      {
        id: 'unsupported-discovery',
        entity_id: 'unsupported',
        entity_type: 'video',
        title: 'Unsupported',
        created_at: Date.now(),
      },
    ];

    const { result } = renderHook(() => useCivicTimeline(options()));

    expect(mocks.agendaCalls.at(-1)).toEqual({
      ids: ['event-a', 'event-b'],
      settled: true,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items.some(item => item.id === 'timeline-event:event-feed-1')).toBe(
      false
    );
    expect(result.current.items.some(item => item.id === 'subscribed:event:subscribed-1')).toBe(
      true
    );
    expect(result.current.discoverCount).toBe(1);
    expect(result.current.mapItems.length).toBeGreaterThan(0);
    expect(result.current.mapItems.some(item => item.statsLabel)).toBe(true);
    expect(result.current.availableTopics).toEqual(
      expect.arrayContaining(['subscribed-topic', 'feed-topic', 'civic', 'discover-topic'])
    );
    expect(result.current.userCoordinates).toEqual({ latitude: 52.52, longitude: 13.405 });
  });

  it('handles unsettled and empty agenda sources and every loading operand', () => {
    mocks.subscribed = { items: [], isLoading: true };
    mocks.subscription = { events: [], isLoading: false };

    const { result, rerender } = renderHook(
      ({ hookOptions }: { hookOptions: UseCivicTimelineOptions }) => useCivicTimeline(hookOptions),
      { initialProps: { hookOptions: options() } }
    );
    expect(mocks.agendaCalls.at(-1)).toEqual({ ids: undefined, settled: false });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.subscribed = { items: [], isLoading: false };
      mocks.subscription = { events: [], isLoading: true };
    });
    rerender({ hookOptions: options() });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.subscription = { events: [], isLoading: false };
      mocks.userLoading = true;
    });
    rerender({ hookOptions: options() });
    expect(mocks.agendaCalls.at(-1)).toEqual({ ids: undefined, settled: true });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.userLoading = false;
      mocks.agenda = { agendaItems: [], isLoading: true };
    });
    rerender({ hookOptions: options() });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.agenda = { agendaItems: [], isLoading: false };
    });
    rerender({ hookOptions: options({ decisionsLoading: true }) });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.discoverResult = { type: 'unknown' };
      mocks.discoverRows = null;
    });
    rerender({ hookOptions: options({ decisionsLoading: false }) });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      mocks.discoverResult = { type: 'complete' };
    });
    rerender({ hookOptions: options({ decisionsLoading: false }) });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});
