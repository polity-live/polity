import { describe, expect, it } from 'vitest';
import {
  buildCivicTimelineItems,
  calculateDistanceKm,
  deriveCivicCoordinates,
  groupCivicTimelineItems,
  rankCivicTimelineItems,
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
});
