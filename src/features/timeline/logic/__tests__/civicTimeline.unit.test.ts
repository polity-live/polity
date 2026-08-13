import { describe, expect, it } from 'vitest';
import {
  buildCivicTimelineItems,
  calculateDistanceKm,
  deriveCivicCoordinates,
  formatDistanceKm,
  getCivicTimelineTimestamp,
  groupCivicTimelineItems,
  isWithinTimelineRadius,
  rankCivicTimelineItems,
  scoreCivicTimelineItem,
  type CivicTimelineItem,
} from '../civicTimeline';

const now = new Date('2026-06-13T12:00:00Z');
const berlin = { latitude: 52.52, longitude: 13.405 };

function item(overrides: Partial<CivicTimelineItem>): CivicTimelineItem {
  return {
    id: overrides.id ?? 'item-1',
    type: overrides.type ?? 'event',
    title: overrides.title ?? 'Timeline item',
    href: overrides.href ?? '/event/item-1',
    timestamp: overrides.timestamp ?? now,
    reason: overrides.reason ?? 'subscribed',
    relationshipStrength: overrides.relationshipStrength ?? 0.5,
    ...overrides,
  };
}

describe('civic timeline logic', () => {
  it('calculates geographic distance with haversine coordinates', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };

    expect(Math.round(calculateDistanceKm(berlin, paris) ?? 0)).toBeGreaterThanOrEqual(875);
    expect(Math.round(calculateDistanceKm(berlin, paris) ?? 0)).toBeLessThanOrEqual(880);
  });

  it('derives the first valid coordinate source for inherited entities', () => {
    const inherited = deriveCivicCoordinates(
      { latitude: null, longitude: null },
      { latitude: 52.52, longitude: 13.405 },
      { latitude: 48.8566, longitude: 2.3522 }
    );

    expect(inherited).toEqual(berlin);
  });

  it('accepts coordinate aliases and rejects missing, nonnumeric, and nonfinite coordinates', () => {
    expect(deriveCivicCoordinates(undefined, null, { lat: 1, lon: 2 })).toEqual({
      latitude: 1,
      longitude: 2,
    });
    expect(
      deriveCivicCoordinates(
        { latitude: Number.NaN, longitude: 1 },
        { latitude: 1, longitude: Number.POSITIVE_INFINITY }
      )
    ).toBeNull();
    expect(calculateDistanceKm(null, berlin)).toBeNull();
    expect(calculateDistanceKm(berlin, undefined)).toBeNull();
  });

  it('selects valid start and timestamp values and falls back from invalid dates', () => {
    expect(
      getCivicTimelineTimestamp(
        item({ startDate: '2026-06-12T12:00:00Z' as never, timestamp: now })
      ).toISOString()
    ).toBe('2026-06-12T12:00:00.000Z');
    expect(getCivicTimelineTimestamp(item({ startDate: 'invalid' as never, timestamp: now }))).toBe(
      now
    );
    expect(
      Number.isNaN(
        getCivicTimelineTimestamp(
          item({ startDate: null, timestamp: 'invalid' as never })
        ).getTime()
      )
    ).toBe(false);
  });

  it('ranks nearby relevant activity above distant activity when other signals match', () => {
    const ranked = rankCivicTimelineItems(
      [
        item({
          id: 'far-event',
          title: 'Far event',
          coordinates: { latitude: 40.7128, longitude: -74.006 },
        }),
        item({
          id: 'near-event',
          title: 'Near event',
          coordinates: berlin,
        }),
      ],
      { userId: 'user-1', coordinates: berlin, now }
    );

    expect(ranked[0].id).toBe('near-event');
    expect(ranked[0].distanceKm).toBe(0);
  });

  it('promotes urgent decisions over stale non-urgent content', () => {
    const ranked = rankCivicTimelineItems(
      [
        item({
          id: 'old-blog',
          type: 'blog',
          title: 'Old blog',
          timestamp: new Date('2026-04-01T12:00:00Z'),
          relationshipStrength: 1,
        }),
        item({
          id: 'closing-vote',
          type: 'vote',
          title: 'Closing vote',
          timestamp: now,
          endDate: new Date('2026-06-13T15:00:00Z'),
          relationshipStrength: 0.7,
        }),
      ],
      { userId: 'user-1', coordinates: berlin, now }
    );

    expect(ranked[0].id).toBe('closing-vote');
    expect(ranked[0].scoreBreakdown?.urgency).toBeGreaterThan(15);
  });

  it('scores every proximity band and the missing-location fallback', () => {
    const proximity = (latitude?: number) =>
      scoreCivicTimelineItem(
        item({ coordinates: latitude == null ? null : { latitude, longitude: berlin.longitude } }),
        { userId: 'user-1', coordinates: berlin, now }
      ).scoreBreakdown?.proximity;

    expect(proximity()).toBe(12.5);
    expect(proximity(52.52)).toBe(25);
    expect(proximity(52.62)).toBe(21.25);
    expect(proximity(53.02)).toBe(16.25);
    expect(proximity(54.52)).toBe(10);
    expect(proximity(62.52)).toBeGreaterThanOrEqual(2);
  });

  it('scores explicit, active, ending, starting, and fallback urgency bands', () => {
    const urgency = (overrides: Partial<CivicTimelineItem>) =>
      scoreCivicTimelineItem(item(overrides), { userId: 'user-1', now }).scoreBreakdown?.urgency;
    const hours = (value: number) => new Date(now.getTime() + value * 3_600_000);

    expect(urgency({ urgency: 2 })).toBe(20);
    expect(urgency({ urgency: -1 })).toBe(0);
    expect(urgency({ startDate: hours(-1), endDate: hours(1) })).toBe(20);
    expect(urgency({ endDate: hours(3) })).toBe(20);
    expect(urgency({ endDate: hours(24) })).toBe(16);
    expect(urgency({ endDate: hours(100) })).toBe(9);
    expect(urgency({ endDate: hours(200) })).toBe(2);
    expect(urgency({ startDate: hours(6) })).toBe(18);
    expect(urgency({ startDate: hours(24) })).toBe(13);
    expect(urgency({ startDate: hours(100) })).toBe(7);
    expect(urgency({ startDate: hours(200), type: 'election' })).toBe(5);
    expect(urgency({ startDate: hours(200), type: 'vote' })).toBe(5);
    expect(urgency({ startDate: hours(200), type: 'blog' })).toBe(2);
    expect(urgency({ startDate: 'invalid' as never, endDate: 'invalid' as never })).toBe(2);
  });

  it('scores explicit and derived engagement signals including empty statistics', () => {
    const noEngagement = scoreCivicTimelineItem(item({ stats: undefined }), {
      userId: 'user-1',
      now,
    });
    expect(noEngagement.scoreBreakdown?.engagement).toBe(0);
    expect(
      scoreCivicTimelineItem(item({ engagementScore: -1 }), { userId: 'user-1', now })
        .scoreBreakdown?.engagement
    ).toBe(0);
    expect(
      scoreCivicTimelineItem(
        item({
          stats: {
            reactions: 1,
            comments: 1,
            views: 100,
            members: 10,
            participants: 2,
            candidates: 1,
          },
        }),
        { userId: 'user-1', now }
      ).scoreBreakdown?.engagement
    ).toBeGreaterThan(0);
    expect(
      scoreCivicTimelineItem(item({ engagementScore: 1_000_000 }), { userId: 'user-1', now })
        .scoreBreakdown?.engagement
    ).toBe(5);
    expect(scoreCivicTimelineItem(item({}), { userId: 'user-1' }).score).toEqual(
      expect.any(Number)
    );
  });

  it('boosts discover items that match user interest tags', () => {
    const ranked = rankCivicTimelineItems(
      [
        item({
          id: 'general-discover',
          type: 'group',
          title: 'General discover item',
          isDiscover: true,
          reason: 'public_discovery',
          tags: ['sports'],
          relationshipStrength: 0.1,
        }),
        item({
          id: 'interest-discover',
          type: 'group',
          title: 'Interest discover item',
          isDiscover: true,
          reason: 'interest_match',
          tags: ['housing'],
          relationshipStrength: 0.1,
        }),
      ],
      { userId: 'user-1', coordinates: berlin, interestTags: ['housing'], now }
    );

    expect(ranked[0].id).toBe('interest-discover');
    expect(ranked[0].scoreBreakdown?.relationship).toBeGreaterThan(
      ranked[1].scoreBreakdown?.relationship ?? 0
    );
  });

  it('handles absent and case-insensitive interest tags and relationship defaults', () => {
    const withoutInterests = scoreCivicTimelineItem(
      item({ relationshipStrength: undefined, tags: ['Housing'] }),
      { userId: 'user-1', interestTags: [], now }
    );
    const withoutItemTags = scoreCivicTimelineItem(
      item({ relationshipStrength: undefined, tags: [] }),
      { userId: 'user-1', interestTags: ['housing'], now }
    );
    const matchingDiscover = scoreCivicTimelineItem(
      item({ relationshipStrength: undefined, isDiscover: true, tags: ['Housing', 'Other'] }),
      { userId: 'user-1', interestTags: ['housing'], now }
    );

    expect(withoutInterests.scoreBreakdown?.relationship).toBe(19.5);
    expect(withoutItemTags.scoreBreakdown?.relationship).toBe(19.5);
    expect(matchingDiscover.scoreBreakdown?.relationship).toBe(10.5);
  });

  it('applies bounded diversity penalties to repeated content types', () => {
    const ranked = rankCivicTimelineItems(
      [
        item({ id: 'one', relationshipStrength: 0.5 }),
        item({ id: 'two', relationshipStrength: 0.5 }),
        item({ id: 'three', relationshipStrength: 0.5 }),
      ],
      { userId: 'user-1', now }
    );

    expect(ranked.map(entry => entry.scoreBreakdown?.diversity).sort()).toEqual([0, 2.5, 5]);
  });

  it('uses discover fallback only when primary activity is sparse and dedupes entities', () => {
    const timeline = buildCivicTimelineItems({
      primaryItems: [item({ id: 'event-1', entityId: 'shared', type: 'event' })],
      discoverItems: [
        item({
          id: 'discover-duplicate',
          entityId: 'shared',
          type: 'event',
          isDiscover: true,
          reason: 'public_discovery',
        }),
        item({
          id: 'discover-1',
          entityId: 'discover-1',
          type: 'amendment',
          isDiscover: true,
          reason: 'public_discovery',
        }),
      ],
      context: { userId: 'user-1', coordinates: berlin, now },
      minPrimaryItems: 3,
    });

    expect(timeline.some(entry => entry.id === 'discover-duplicate')).toBe(false);
    expect(timeline.some(entry => entry.id === 'discover-1')).toBe(true);
  });

  it('returns sufficient primary items unchanged and applies default discovery limits and reasons', () => {
    const sufficient = Array.from({ length: 8 }, (_, index) => item({ id: `primary-${index}` }));
    expect(
      buildCivicTimelineItems({
        primaryItems: sufficient,
        discoverItems: [item({ id: 'unused' })],
        context: { userId: 'user-1', now },
      })
    ).toHaveLength(8);

    const discovered = buildCivicTimelineItems({
      primaryItems: [],
      discoverItems: Array.from({ length: 6 }, (_, index) =>
        item({ id: `discover-${index}`, entityId: undefined, reason: undefined as never })
      ),
      context: { userId: 'user-1', now },
      minPrimaryItems: 1,
    });
    expect(discovered).toHaveLength(4);
    expect(discovered.every(entry => entry.reason === 'public_discovery')).toBe(true);
  });

  it('groups current, upcoming, later, and discover items into timeline sections', () => {
    const sections = groupCivicTimelineItems(
      [
        item({
          id: 'now',
          startDate: new Date('2026-06-13T10:00:00Z'),
          endDate: new Date('2026-06-13T14:00:00Z'),
        }),
        item({ id: 'today', timestamp: new Date('2026-06-13T08:00:00Z') }),
        item({ id: 'week', timestamp: new Date('2026-06-16T08:00:00Z') }),
        item({ id: 'later', timestamp: new Date('2026-07-01T08:00:00Z') }),
        item({ id: 'discover', isDiscover: true, reason: 'public_discovery' }),
      ],
      now
    );

    expect(sections.map(section => section.id)).toEqual([
      'now',
      'today',
      'this_week',
      'later',
      'discover',
    ]);
  });

  it('groups urgent elections and past, cross-day, and empty timelines at exact boundaries', () => {
    const sections = groupCivicTimelineItems(
      [
        item({
          id: 'urgent-election',
          type: 'election',
          endDate: new Date(now.getTime() + 48 * 3_600_000),
        }),
        item({
          id: 'nonurgent-vote',
          type: 'vote',
          endDate: new Date(now.getTime() + 49 * 3_600_000),
          timestamp: new Date(now.getTime() + 8 * 86_400_000),
        }),
        item({ id: 'past', timestamp: new Date(now.getTime() - 24 * 3_600_000) }),
      ],
      now
    );
    expect(sections.find(section => section.id === 'now')?.items[0]?.id).toBe('urgent-election');
    expect(sections.find(section => section.id === 'later')?.items[0]?.id).toBe('nonurgent-vote');
    expect(sections.find(section => section.id === 'this_week')?.items[0]?.id).toBe('past');
    expect(groupCivicTimelineItems([], now)).toEqual([]);
  });

  it('checks radius guards, exact distances, and formats every distance band', () => {
    const located = item({ coordinates: berlin });
    expect(isWithinTimelineRadius(located, 'all', undefined)).toBe(true);
    expect(isWithinTimelineRadius(located, 1, null)).toBe(true);
    expect(isWithinTimelineRadius(item({ coordinates: null }), 1, berlin)).toBe(true);
    expect(isWithinTimelineRadius(located, 0, berlin)).toBe(true);
    expect(
      isWithinTimelineRadius(
        item({ coordinates: { latitude: 53.52, longitude: 13.405 } }),
        10,
        berlin
      )
    ).toBe(false);

    expect(formatDistanceKm(null)).toBeNull();
    expect(formatDistanceKm(0.4)).toBe('<1 km');
    expect(formatDistanceKm(1.25)).toBe('1.3 km');
    expect(formatDistanceKm(10.4)).toBe('10 km');
  });
});
