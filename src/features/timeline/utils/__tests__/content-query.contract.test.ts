import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAdminGroupFilters,
  buildAmendmentFilters,
  buildEventFilters,
  combineOwnContent,
  getOwnContentStats,
  transformAmendmentToContentItem,
  transformEventToContentItem,
  transformGroupToContentItem,
  type OwnContentResult,
} from '../own-content-query';
import {
  buildPublicContentFilters,
  calculateEngagementScore,
  calculateEngagementVelocity,
  excludeInteractedItems,
  isPublicContent,
  transformToContentItem,
} from '../public-content-query';
import type { ContentItem } from '../../logic/content-reasons';

describe('timeline content query utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T00:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('builds own-content filters with and without age/draft constraints', () => {
    expect(
      buildAmendmentFilters('user', {
        userId: 'user',
        maxAgeDays: 10,
        includeDrafts: false,
      })
    ).toEqual({
      authorId: 'user',
      createdAfter: new Date('2026-01-21T00:00:00.000Z'),
      excludeStatus: 'draft',
    });
    expect(
      buildAmendmentFilters('user', { userId: 'user', maxAgeDays: 0, includeDrafts: true })
    ).toEqual({ authorId: 'user' });
    expect(buildEventFilters('user', { userId: 'user', maxAgeDays: 5 })).toEqual({
      organizerId: 'user',
      createdAfter: new Date('2026-01-26T00:00:00.000Z'),
    });
    expect(buildEventFilters('user', { userId: 'user', maxAgeDays: 0 })).toEqual({
      organizerId: 'user',
    });
    expect(buildAdminGroupFilters('user')).toEqual({ adminId: 'user' });
  });

  it('transforms own amendments, events, and groups with optional values', () => {
    expect(
      transformAmendmentToContentItem(
        {
          id: 'amendment',
          commentCount: 2,
          voteCount: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        'user'
      )
    ).toMatchObject({ engagementScore: 5, createdAt: new Date('2026-01-01T00:00:00.000Z') });
    expect(transformAmendmentToContentItem({ id: 'empty' }, 'user')).toMatchObject({
      engagementScore: 0,
      createdAt: undefined,
    });
    expect(
      transformEventToContentItem(
        { id: 'event', participantCount: 4, createdAt: '2026-01-02T00:00:00.000Z' },
        'user'
      )
    ).toMatchObject({ engagementScore: 4, createdAt: new Date('2026-01-02T00:00:00.000Z') });
    expect(
      transformEventToContentItem({ id: 'empty-event', participantCount: 0 }, 'user')
    ).toMatchObject({ engagementScore: 0, createdAt: undefined });
    expect(
      transformGroupToContentItem(
        { id: 'group', memberCount: 6, createdAt: '2026-01-03T00:00:00.000Z' },
        'user'
      )
    ).toMatchObject({ engagementScore: 6, createdAt: new Date('2026-01-03T00:00:00.000Z') });
    expect(
      transformGroupToContentItem({ id: 'empty-group', memberCount: 0 }, 'user')
    ).toMatchObject({ engagementScore: 0, createdAt: undefined });
  });

  it('combines every category by date and derives engagement stats', () => {
    const item = (id: string, engagementScore?: number, createdAt?: Date): ContentItem =>
      ({ id, type: 'blog', engagementScore, createdAt }) as ContentItem;
    const result: OwnContentResult = {
      amendments: [item('old', 1, new Date(10))],
      events: [item('undated', undefined)],
      groups: [item('new', 8, new Date(20))],
      media: [item('tie', 8, new Date(15))],
      statements: [],
      blogs: [],
      totalCount: 4,
    };
    expect(combineOwnContent(result).map(entry => entry.id)).toEqual([
      'new',
      'tie',
      'old',
      'undated',
    ]);
    expect(getOwnContentStats(result)).toMatchObject({
      totalItems: 4,
      totalEngagement: 17,
      topPerforming: expect.objectContaining({ id: 'new' }),
    });
    expect(
      getOwnContentStats({
        amendments: [],
        events: [],
        groups: [],
        media: [],
        statements: [],
        blogs: [],
        totalCount: 0,
      })
    ).toEqual({ totalItems: 0, totalEngagement: 0, topPerforming: null });
  });

  it('builds every optional public-content filter', () => {
    expect(
      buildPublicContentFilters({
        userId: 'user',
        subscribedGroupIds: ['group'],
        contentTypes: ['event'],
        minEngagement: 2,
        maxAgeDays: 7,
        topicIds: ['topic'],
      })
    ).toEqual({
      excludeGroupIds: ['group'],
      contentTypes: ['event'],
      minEngagement: 2,
      createdAfter: new Date('2026-01-24T00:00:00.000Z'),
      topicIds: ['topic'],
    });
    expect(
      buildPublicContentFilters({
        userId: 'user',
        subscribedGroupIds: [],
        contentTypes: [],
        minEngagement: 0,
        maxAgeDays: 0,
        topicIds: [],
      })
    ).toEqual({});
    expect(buildPublicContentFilters({ userId: 'user', subscribedGroupIds: [] })).toEqual({});
  });

  it('transforms public items and calculates weighted engagement', () => {
    expect(
      transformToContentItem(
        {
          id: 'public',
          createdAt: '2026-01-01T00:00:00.000Z',
          engagementScore: 5,
        },
        'event'
      )
    ).toMatchObject({ createdAt: new Date('2026-01-01T00:00:00.000Z'), isUserContent: false });
    expect(transformToContentItem({ id: 'undated' }, 'group')).toMatchObject({
      createdAt: undefined,
    });
    expect(calculateEngagementScore({ shares: 1, comments: 2, reactions: 3, views: 100 })).toBe(18);
    expect(calculateEngagementScore({})).toBe(0);
  });

  it('calculates velocity, visibility, and interaction exclusions', () => {
    expect(calculateEngagementVelocity(10, 4, 2)).toBe(3);
    expect(calculateEngagementVelocity(4, 10, 2)).toBe(-3);
    expect(calculateEngagementVelocity(10, 4, 0)).toBe(0);
    expect(calculateEngagementVelocity(10, 4, -1)).toBe(0);
    expect(isPublicContent({ visibility: 'public', status: 'inactive' })).toBe(true);
    for (const status of ['published', 'active', 'view', 'passed']) {
      expect(isPublicContent({ visibility: 'private', status })).toBe(true);
    }
    expect(isPublicContent({ visibility: 'private', status: 'inactive' })).toBe(false);
    expect(isPublicContent({ visibility: 'private' })).toBe(false);

    const items = [
      { id: 'keep', type: 'group' },
      { id: 'remove', type: 'group' },
    ] as ContentItem[];
    expect(excludeInteractedItems(items, new Set(['remove']))).toEqual([items[0]]);
  });
});
