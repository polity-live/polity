import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgendaStateItem } from '@/zero/agendas/useAgendaState';
import {
  applyFilters,
  asDate,
  asNumber,
  asString,
  getEngagementValue,
  getHref,
  getMatchingInterestTags,
  getReasonForItem,
  getStatsLabel,
  getTagsFromJunctions,
  isRecord,
  mapAgendaItemToCivicTimelineItem,
  mapDecisionItem,
  mapSearchDocument,
  mapSubscribedItem,
  mapTimelineEvent,
  normalizeTimelineType,
  passesDateFilter,
} from '../useCivicTimeline';

afterEach(() => vi.useRealTimers());

const activatedAt = new Date('2026-06-19T13:05:00Z').getTime();
const plannedStart = new Date('2026-06-20T08:00:00Z').getTime();

function agendaItem(overrides: Partial<AgendaStateItem>): AgendaStateItem {
  return {
    id: 'agenda-1',
    event_id: 'event-1',
    amendment_id: null,
    creator_id: 'user-1',
    title: 'Agenda vote',
    description: null,
    type: 'vote',
    status: 'planned',
    forwarding_status: null,
    order_index: 1,
    duration: 30,
    scheduled_time: null,
    start_time: null,
    end_time: null,
    activated_at: null,
    completed_at: null,
    majority_type: null,
    time_limit: null,
    voting_phase: null,
    created_at: new Date('2026-06-01T08:00:00Z').getTime(),
    updated_at: new Date('2026-06-01T08:00:00Z').getTime(),
    calculated_start_time: plannedStart,
    calculated_end_time: plannedStart + 30 * 60_000,
    event: {
      id: 'event-1',
      title: 'Future assembly',
      location_name: null,
      latitude: null,
      longitude: null,
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
    },
    ...overrides,
  } as unknown as AgendaStateItem;
}

describe('useCivicTimeline agenda mapping', () => {
  it('maps activated agenda items by actual runtime instead of planned event time', () => {
    const item = mapAgendaItemToCivicTimelineItem(
      agendaItem({
        status: 'in-progress',
        duration: 45,
        activated_at: activatedAt,
        start_time: activatedAt,
      })
    );

    expect(item?.timestamp.getTime()).toBe(activatedAt);
    expect(item?.startDate?.getTime()).toBe(activatedAt);
    expect(item?.endDate?.getTime()).toBe(activatedAt + 45 * 60_000);
    expect(item?.status).toBe('in-progress');
    expect(item?.reason).toBe('active_now');
  });

  it('keeps unstarted agenda items on their calculated schedule', () => {
    const item = mapAgendaItemToCivicTimelineItem(agendaItem({}));

    expect(item?.timestamp.getTime()).toBe(plannedStart);
    expect(item?.startDate?.getTime()).toBe(plannedStart);
    expect(item?.endDate?.getTime()).toBe(plannedStart + 30 * 60_000);
    expect(item?.status).toBe('planned');
    expect(item?.reason).toBe('member_context');
  });

  it('rejects agenda rows without an event and maps title and election fallbacks', () => {
    expect(mapAgendaItemToCivicTimelineItem(agendaItem({ event: null } as any))).toBeNull();

    const amendmentFallback = mapAgendaItemToCivicTimelineItem(
      agendaItem({
        title: '',
        amendment: { title: 'Amendment fallback' } as any,
        election: { id: 'election-1' } as any,
      } as any)
    );
    expect(amendmentFallback?.title).toBe('Amendment fallback');
    expect(amendmentFallback?.stats?.candidates).toBe(1);

    const genericFallback = mapAgendaItemToCivicTimelineItem(
      agendaItem({ title: '', amendment: null, election: undefined } as any)
    );
    expect(genericFallback?.title).toBeTruthy();
    expect(genericFallback?.stats?.candidates).toBeUndefined();

    const candidates = mapAgendaItemToCivicTimelineItem(
      agendaItem({ election: [{ id: 'one' }, { id: 'two' }] } as any)
    );
    expect(candidates?.stats?.candidates).toBe(2);

    const createdOnly = mapAgendaItemToCivicTimelineItem(
      agendaItem({
        duration: null,
        start_time: null,
        end_time: null,
        calculated_start_time: null,
        calculated_end_time: null,
      } as any)
    );
    expect(createdOnly?.timestamp.getTime()).toBe(agendaItem({}).created_at);

    const currentFallback = mapAgendaItemToCivicTimelineItem(
      agendaItem({
        created_at: 'invalid' as any,
        duration: null,
        start_time: null,
        end_time: null,
        calculated_start_time: null,
        calculated_end_time: null,
      } as any)
    );
    expect(currentFallback?.timestamp).toBeInstanceOf(Date);
  });
});

describe('useCivicTimeline primitive boundaries', () => {
  it('normalizes records, strings, numbers, and dates', () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('value')).toBe(false);

    expect(asString(' value ')).toBe(' value ');
    expect(asString('   ')).toBeUndefined();
    expect(asString(1)).toBeUndefined();

    expect(asNumber(4)).toBe(4);
    expect(asNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(asNumber(' 4.5 ')).toBe(4.5);
    expect(asNumber('')).toBeUndefined();
    expect(asNumber('nope')).toBeUndefined();
    expect(asNumber(null)).toBeUndefined();

    const date = new Date('2026-01-01T00:00:00Z');
    expect(asDate(date)).toBe(date);
    expect(asDate(date.toISOString())?.getTime()).toBe(date.getTime());
    expect(asDate(date.getTime())?.getTime()).toBe(date.getTime());
    expect(asDate(null)).toBeUndefined();
    expect(asDate('')).toBeUndefined();
    expect(asDate('invalid')).toBeUndefined();
  });

  it('normalizes every civic type and route family', () => {
    expect(normalizeTimelineType('activity')).toBe('workflow');
    expect(normalizeTimelineType('action')).toBe('workflow');
    for (const type of [
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
    ] as const) {
      expect(normalizeTimelineType(type)).toBe(type);
    }
    expect(normalizeTimelineType('video')).toBeNull();
    expect(normalizeTimelineType(null)).toBeNull();

    expect(getHref('group', '1')).toBe('/group/1');
    expect(getHref('event', '1')).toBe('/event/1');
    expect(getHref('amendment', '1')).toBe('/amendment/1');
    expect(getHref('blog', '1')).toBe('/blog/1');
    expect(getHref('statement', '1')).toBe('/statement/1');
    expect(getHref('user', '1')).toBe('/user/1');
    expect(getHref('vote', '1')).toBe('/search');
    expect(getHref('election', '1', '/fallback')).toBe('/fallback');
    expect(getHref('agenda_item', '1')).toBe('/search');
    expect(getHref('workflow', '1')).toBe('/search');
  });

  it('derives matching interests, recommendation reasons, labels, and junction tags', () => {
    expect(getMatchingInterestTags([], ['civic'])).toEqual([]);
    expect(getMatchingInterestTags(['civic'], [])).toEqual([]);
    expect(getMatchingInterestTags(['Civic', 'Other'], ['civic'])).toEqual(['Civic']);
    expect(getMatchingInterestTags(['Other'], ['civic'])).toEqual([]);

    expect(getReasonForItem({ type: 'event', isUrgent: true })).toBe('urgent_decision');
    expect(
      getReasonForItem({
        type: 'event',
        isDiscover: true,
        tags: ['Civic'],
        interestTags: ['civic'],
      })
    ).toBe('interest_match');
    expect(
      getReasonForItem({
        type: 'event',
        isDiscover: true,
        coordinates: { latitude: 1, longitude: 2 },
        userCoordinates: { latitude: 1, longitude: 2 },
      })
    ).toBe('near_you');
    expect(getReasonForItem({ type: 'event', isDiscover: true })).toBe('public_discovery');
    expect(getReasonForItem({ type: 'vote' })).toBe('active_now');
    expect(getReasonForItem({ type: 'election' })).toBe('active_now');
    expect(getReasonForItem({ type: 'event' })).toBe('subscribed');

    expect(
      getStatsLabel({ type: 'event', stats: { participants: 3, candidates: 2 } })
    ).toBeTruthy();
    expect(getStatsLabel({ type: 'election', stats: { candidates: 2, comments: 1 } })).toBeTruthy();
    expect(getStatsLabel({ type: 'blog', stats: { comments: 1, members: 4 } })).toBeTruthy();
    expect(getStatsLabel({ type: 'group', stats: { members: 4 } })).toBeTruthy();
    expect(getStatsLabel({ type: 'group', stats: { members: 0 } })).toBeNull();
    expect(getStatsLabel({ type: 'group' })).toBeNull();

    expect(getTagsFromJunctions()).toEqual([]);
    expect(
      getTagsFromJunctions([
        { hashtag: { tag: 'one' } },
        { hashtag: { tag: null } },
        { hashtag: null },
      ])
    ).toEqual(['one']);
  });
});

function subscribedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    entityId: 'entity-1',
    type: 'event',
    title: 'Subscribed event',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as any;
}

describe('useCivicTimeline subscribed item mapping', () => {
  it('rejects unsupported entries and maps agenda links and direct statistics', () => {
    expect(mapSubscribedItem(subscribedItem({ type: 'video' }))).toBeNull();

    const item = mapSubscribedItem(
      subscribedItem({
        type: 'agenda_item',
        entityId: undefined,
        eventId: 'event-1',
        agendaEventId: 'event-1',
        agendaItemId: 'agenda-1',
        groupId: 'group-1',
        groupName: 'Group',
        eventName: 'Event',
        authorName: 'Author',
        tags: ['civic'],
        latitude: 10,
        longitude: 20,
        attendeeCount: 3,
        commentCount: 4,
        memberCount: 5,
        stats: { reactions: 1, comments: 2, views: 6, members: 7 },
      })
    );

    expect(item?.entityId).toBe('event-1');
    expect(item?.href).toBe('/event/event-1/agenda/agenda-1');
    expect(item?.sourceName).toBe('Group');
    expect(item?.sourceHref).toBe('/group/group-1');
    expect(item?.stats).toMatchObject({ comments: 4, members: 5, participants: 3 });
    expect(item?.statsLabel).toBeTruthy();
  });

  it('falls through entity, source, route, and optional statistic candidates', () => {
    const event = mapSubscribedItem(
      subscribedItem({
        type: 'event',
        entityId: undefined,
        eventId: undefined,
        groupId: 'group-1',
        groupName: undefined,
        eventName: 'Event source',
        commentCount: undefined,
        memberCount: undefined,
        stats: { comments: 2, members: 3 },
      })
    );
    expect(event?.entityId).toBe('group-1');
    expect(event?.sourceName).toBe('Event source');
    expect(event?.sourceHref).toBe('/group/group-1');
    expect(event?.stats?.comments).toBe(2);
    expect(event?.stats?.members).toBe(3);

    const author = mapSubscribedItem(
      subscribedItem({
        type: 'user',
        entityId: undefined,
        eventId: undefined,
        groupId: undefined,
        authorId: 'author-1',
        authorName: 'Author',
      })
    );
    expect(author?.entityId).toBe('author-1');
    expect(author?.sourceName).toBe('Author');
    expect(author?.sourceHref).toBeUndefined();

    const eventSource = mapSubscribedItem(
      subscribedItem({ type: 'event', groupId: undefined, eventId: 'event-source' })
    );
    expect(eventSource?.sourceHref).toBe('/event/event-source');

    const ownId = mapSubscribedItem(
      subscribedItem({
        type: 'action',
        entityId: undefined,
        eventId: undefined,
        groupId: undefined,
        authorId: undefined,
      })
    );
    expect(ownId?.entityId).toBe('sub-1');
    expect(ownId?.type).toBe('workflow');
    expect(ownId?.sourceName).toBeUndefined();
  });
});

function timelineEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'timeline-1',
    entity_id: 'entity-1',
    content_type: 'event',
    entity_type: null,
    title: 'Timeline event',
    description: 'Description',
    created_at: new Date('2026-01-01T00:00:00Z').getTime(),
    ends_at: null,
    event: null,
    group: null,
    user: null,
    amendment: null,
    blog: null,
    statement: null,
    election: null,
    ...overrides,
  } as any;
}

describe('useCivicTimeline timeline event mapping', () => {
  it('rejects unsupported and expired statement events', () => {
    expect(mapTimelineEvent(timelineEvent({ content_type: 'video' }))).toBeNull();
    expect(mapTimelineEvent(timelineEvent({ content_type: '', entity_type: '' }))).toBeNull();
    expect(
      mapTimelineEvent(
        timelineEvent({ content_type: 'statement', ends_at: '2020-01-01T00:00:00Z' })
      )
    ).toBeNull();
  });

  it('maps event locations, supplied tags, sources, and optional statistics', () => {
    const item = mapTimelineEvent(
      timelineEvent({
        content_type: '',
        entity_type: 'event',
        entity_id: '',
        title: '',
        event: {
          id: 'event-1',
          title: 'Nested event',
          start_date: '2026-03-01T10:00:00Z',
          location_name: 'Hall',
          latitude: 1,
          longitude: 2,
          participants: [{ id: 'one' }, { id: 'two' }],
        },
        group: { id: 'group-1', name: 'Group' },
        tags: ['one', 'one', ''],
        stats: { reactions: 1, comments: 2, views: 3, members: 4 },
      })
    );

    expect(item?.entityId).toBe('event-1');
    expect(item?.title).toBe('Nested event');
    expect(item?.sourceName).toBe('Group');
    expect(item?.sourceHref).toBe('/group/group-1');
    expect(item?.locationLabel).toContain('Hall');
    expect(item?.tags).toEqual(['one']);
    expect(item?.stats?.participants).toBe(2);
    expect(item?.reason).toBe('subscribed');
  });

  it('maps voting agenda links, derived tags, fallbacks, and active states', () => {
    const vote = mapTimelineEvent(
      timelineEvent({
        content_type: 'vote',
        entity_id: '',
        title: '',
        created_at: 'invalid',
        vote_status: 'open',
        amendment: {
          id: 'amendment-1',
          amendment_hashtags: [{ hashtag: { tag: 'amendment' } }],
        },
        election: {
          agenda_item: { id: 'agenda-1', event: { id: 'event-1' } },
        },
        blog: { blog_hashtags: [{ hashtag: { tag: 'blog' } }] },
        user: {
          id: 'user-1',
          handle: 'voter',
          user_hashtags: [{ hashtag: { tag: 'user' } }],
        },
        event: { event_hashtags: [{ hashtag: { tag: 'event' } }] },
      })
    );
    expect(vote?.entityId).toBe('amendment-1');
    expect(vote?.href).toBe('/event/event-1/agenda/agenda-1');
    expect(vote?.status).toBe('open');
    expect(vote?.reason).toBe('active_now');
    expect(vote?.tags).toEqual(['event', 'amendment', 'blog', 'user']);

    const election = mapTimelineEvent(
      timelineEvent({
        content_type: 'election',
        entity_id: '',
        title: '',
        event: null,
        amendment: null,
        blog: null,
        statement: null,
        election: { id: 'election-1' },
        group: { id: 'group-1', name: 'Election group', city: 'Berlin' },
        user: null,
        election_status: 'active',
      })
    );
    expect(election?.entityId).toBe('election-1');
    expect(election?.title).toBe('Election group');
    expect(election?.locationLabel).toContain('Berlin');
    expect(election?.status).toBe('active');
  });

  it('falls through entity, user, title, location, and source candidates', () => {
    const user = mapTimelineEvent(
      timelineEvent({
        content_type: 'user',
        entity_id: '',
        title: '',
        event: null,
        amendment: null,
        blog: null,
        statement: null,
        election: null,
        group: null,
        user: { id: 'user-1', handle: 'person', city: 'Paris' },
      })
    );
    expect(user?.entityId).toBe('user-1');
    expect(user?.title).toBe('person');
    expect(user?.locationLabel).toContain('Paris');
    expect(user?.sourceName).toBe('person');
    expect(user?.sourceHref).toBeUndefined();

    const eventSource = mapTimelineEvent(
      timelineEvent({
        content_type: 'event',
        entity_id: '',
        group: null,
        event: { id: 'event-source', title: 'Source event' },
      })
    );
    expect(eventSource?.sourceHref).toBe('/event/event-source');

    const own = mapTimelineEvent(
      timelineEvent({
        content_type: 'workflow',
        entity_id: '',
        title: '',
        event: null,
        group: null,
        user: null,
      })
    );
    expect(own?.entityId).toBe('timeline-1');
    expect(own?.title).toBeTruthy();
    expect(own?.locationLabel).toBeUndefined();
  });
});

describe('useCivicTimeline decision and discovery mapping', () => {
  it('maps decision priority, sources, dates, and urgency levels', () => {
    const base = {
      id: 'decision-1',
      type: 'vote',
      title: 'Decision',
      body: 'Body',
      status: 'open',
      votedCount: 2,
      totalMembers: 10,
    } as any;

    const urgent = mapDecisionItem({
      ...base,
      href: '/vote',
      summary: 'Summary',
      isUrgent: true,
      agendaItem: { name: 'Agenda', href: '/agenda' },
      entity: { name: 'Entity', href: '/entity' },
      candidates: [{ id: 'one' }],
    });
    expect(urgent).toMatchObject({
      type: 'vote',
      href: '/vote',
      description: 'Summary',
      sourceName: 'Agenda',
      sourceHref: '/agenda',
      urgency: 1,
      reason: 'urgent_decision',
    });

    expect(
      mapDecisionItem({
        ...base,
        type: 'election',
        isClosingSoon: true,
        entity: { name: 'Entity' },
      }).urgency
    ).toBe(0.8);
    expect(mapDecisionItem({ ...base, isOpeningSoon: true }).urgency).toBe(0.55);
    const ordinary = mapDecisionItem({ ...base });
    expect(ordinary.urgency).toBe(0.35);
    expect(ordinary.href).toBe('#');
    expect(ordinary.sourceName).toBe('Body');
    expect(ordinary.sourceHref).toBeUndefined();
    expect(ordinary.stats?.candidates).toBeUndefined();
  });

  it('rejects unsupported discovery types and maps interest, nearby, and public documents', () => {
    const base = {
      id: 'search-1',
      entity_id: 'event-1',
      entity_type: 'event',
      title: 'Discovery',
      subtitle: 'Subtitle',
      summary: null,
      search_text: 'Search text',
      created_at: new Date('2026-01-01T00:00:00Z').getTime(),
    } as any;

    expect(mapSearchDocument({ ...base, entity_type: 'user' }, null, [])?.type).toBe('user');
    expect(mapSearchDocument({ ...base, card_payload: { type: 'video' } }, null, [])).toBeNull();

    const interest = mapSearchDocument(
      {
        ...base,
        card_payload: {
          type: 'event',
          tags: ['Civic', 4],
          starts_at: '2026-02-01T00:00:00Z',
          ends_at: '2026-02-02T00:00:00Z',
          location: 'Payload place',
          status: 'open',
          stats: {
            reactions: '2',
            comments: 3,
            members: 'bad',
            participants: 4,
            candidates: 5,
          },
        },
        topics: [{ topic: 'Topic' }, { topic: null }],
        group: { id: 'group-1', name: 'Group' },
        engagement_score: 0,
        trending_score: 9,
      },
      null,
      ['civic']
    );
    expect(interest).toMatchObject({
      reason: 'interest_match',
      locationLabel: 'Payload place',
      sourceName: 'Group',
      sourceHref: '/group/group-1',
      engagementScore: 0,
      description: 'Search text',
    });
    expect(interest?.tags).toEqual(['Civic', 'Topic']);
    expect(interest?.stats).toMatchObject({ reactions: 2, comments: 3, participants: 4 });
    expect(interest?.stats?.members).toBeUndefined();

    const nearby = mapSearchDocument(
      {
        ...base,
        summary: 'Summary',
        card_payload: { latitude: 1, longitude: 2, metadata: { label: 'meta' } },
        engagement_score: null,
        trending_score: 7,
        group: { name: 'Group fallback', city: 'Berlin' },
      },
      { latitude: 1, longitude: 2 },
      []
    );
    expect(nearby?.reason).toBe('near_you');
    expect(nearby?.engagementScore).toBe(7);
    expect(nearby?.description).toBe('Summary');
    expect(nearby?.locationLabel).toContain('Berlin');

    const publicItem = mapSearchDocument(
      { ...base, created_at: 'invalid', card_payload: null, topics: undefined },
      null,
      []
    );
    expect(publicItem?.reason).toBe('public_discovery');
    expect(publicItem?.locationLabel).toBe('Subtitle');
    expect(publicItem?.relationshipStrength).toBe(0.2);
  });
});

function civicItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    entityId: 'item-1',
    type: 'event',
    title: 'Item',
    href: '/event/item-1',
    timestamp: new Date(),
    tags: [],
    stats: {},
    ...overrides,
  } as any;
}

const allFilters = {
  contentTypes: ['event'],
  dateRange: 'all',
  topics: [],
  engagement: 'all',
} as any;

describe('useCivicTimeline filtering', () => {
  it('evaluates every date range boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    expect(passesDateFilter(civicItem(), 'all')).toBe(true);
    expect(
      passesDateFilter(civicItem({ timestamp: new Date('2026-06-15T01:00:00Z') }), 'today')
    ).toBe(true);
    expect(
      passesDateFilter(civicItem({ timestamp: new Date('2026-06-14T20:00:00Z') }), 'today')
    ).toBe(false);
    expect(
      passesDateFilter(civicItem({ timestamp: new Date('2026-06-10T12:00:00Z') }), 'week')
    ).toBe(true);
    expect(
      passesDateFilter(civicItem({ timestamp: new Date('2026-05-20T12:00:00Z') }), 'month')
    ).toBe(true);
    expect(
      passesDateFilter(civicItem({ timestamp: new Date('2025-01-01T00:00:00Z') }), 'year')
    ).toBe(false);
  });

  it('calculates explicit and accumulated engagement', () => {
    expect(getEngagementValue(civicItem({ engagementScore: 0 }))).toBe(0);
    expect(
      getEngagementValue(civicItem({ stats: { reactions: 1, comments: 2, views: 3, members: 4 } }))
    ).toBe(10);
    expect(getEngagementValue(civicItem({ stats: undefined }))).toBe(0);
  });

  it('filters content, dates, distance, topics, and engagement modes', () => {
    const current = civicItem({ tags: ['civic'], stats: { comments: 2 }, engagementScore: 6 });
    expect(applyFilters([current], allFilters, 'all', null)).toEqual([current]);
    expect(
      applyFilters([current], { ...allFilters, contentTypes: ['group'] }, 'all', null)
    ).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ timestamp: new Date('2020-01-01T00:00:00Z') })],
        { ...allFilters, dateRange: 'week' },
        'all',
        null
      )
    ).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ coordinates: { latitude: 50, longitude: 50 } })],
        allFilters,
        5 as never,
        { latitude: 1, longitude: 1 }
      )
    ).toEqual([]);
    expect(applyFilters([current], { ...allFilters, topics: ['civic'] }, 'all', null)).toEqual([
      current,
    ]);
    expect(applyFilters([current], { ...allFilters, topics: ['other'] }, 'all', null)).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ tags: undefined })],
        { ...allFilters, topics: ['civic'] },
        'all',
        null
      )
    ).toEqual([]);

    expect(applyFilters([current], { ...allFilters, engagement: 'popular' }, 'all', null)).toEqual([
      current,
    ]);
    expect(
      applyFilters(
        [civicItem({ engagementScore: 4 })],
        { ...allFilters, engagement: 'popular' },
        'all',
        null
      )
    ).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ scoreBreakdown: { urgency: 1 } })],
        { ...allFilters, engagement: 'rising' },
        'all',
        null
      )
    ).toHaveLength(1);
    expect(
      applyFilters(
        [civicItem({ scoreBreakdown: undefined, urgency: 1 })],
        { ...allFilters, engagement: 'rising' },
        'all',
        null
      )
    ).toHaveLength(1);
    expect(
      applyFilters(
        [civicItem({ urgency: 0 })],
        { ...allFilters, engagement: 'rising' },
        'all',
        null
      )
    ).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ scoreBreakdown: undefined, urgency: undefined })],
        { ...allFilters, engagement: 'rising' },
        'all',
        null
      )
    ).toEqual([]);
    expect(
      applyFilters(
        [civicItem({ stats: { comments: 1 } })],
        { ...allFilters, engagement: 'discussed' },
        'all',
        null
      )
    ).toHaveLength(1);
    expect(
      applyFilters(
        [civicItem({ stats: undefined })],
        { ...allFilters, engagement: 'discussed' },
        'all',
        null
      )
    ).toEqual([]);
  });
});
