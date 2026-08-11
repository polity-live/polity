import { describe, it, expect } from 'vitest';
import {
  applyDiversityPenalty,
  scoreContent,
  scoreAndSortContent,
  getTopScoredContent,
  separateScoredContent,
} from '../../logic/content-scoring';
import type { ContentItem, UserContext } from '../../logic/content-reasons';

describe('content-scoring', () => {
  // Helper to create mock content
  const createMockContent = (overrides?: Partial<ContentItem>): ContentItem => ({
    id: 'test-id-1',
    type: 'amendment',
    createdAt: new Date(),
    topics: ['climate'],
    engagementScore: 100,
    recentEngagementVelocity: 50,
    ...overrides,
  });

  // Helper to create mock user context
  const createMockUserContext = (overrides?: Partial<UserContext>): UserContext => ({
    userId: 'user-1',
    followedTopics: ['climate', 'transport'],
    subscribedGroupIds: [],
    recentInteractions: [],
    ...overrides,
  });

  describe('scoreContent', () => {
    it('should return a ScoredContent object with score and breakdown', () => {
      const content = createMockContent();
      const userContext = createMockUserContext();

      const result = scoreContent(content, userContext);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('scoreBreakdown');
      expect(typeof result.score).toBe('number');
    });

    it('should score trending content higher', () => {
      const userContext = createMockUserContext();

      const trendingContent = createMockContent({
        id: 'trending',
        recentEngagementVelocity: 500,
      });
      const nonTrendingContent = createMockContent({
        id: 'non-trending',
        recentEngagementVelocity: 0,
      });

      const trendingScore = scoreContent(trendingContent, userContext);
      const nonTrendingScore = scoreContent(nonTrendingContent, userContext);

      expect(trendingScore.scoreBreakdown.trending).toBeGreaterThan(
        nonTrendingScore.scoreBreakdown.trending
      );
    });

    it('should score fresh content higher', () => {
      const userContext = createMockUserContext();

      const freshContent = createMockContent({
        id: 'fresh',
        createdAt: new Date(),
      });
      const oldContent = createMockContent({
        id: 'old',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });

      const freshScore = scoreContent(freshContent, userContext);
      const oldScore = scoreContent(oldContent, userContext);

      expect(freshScore.scoreBreakdown.freshness).toBeGreaterThan(
        oldScore.scoreBreakdown.freshness
      );
    });

    it('should boost user own content', () => {
      const content = createMockContent({
        authorId: 'user-1',
      });
      const userContext = createMockUserContext({
        userId: 'user-1',
      });

      const result = scoreContent(content, userContext);

      expect(result.scoreBreakdown.userContent).toBeGreaterThan(0);
    });

    it('should not boost content from other users', () => {
      const content = createMockContent({
        authorId: 'other-user',
      });
      const userContext = createMockUserContext({
        userId: 'user-1',
      });

      const result = scoreContent(content, userContext);

      expect(result.scoreBreakdown.userContent).toBe(0);
    });

    it('should score matching topics higher', () => {
      const userContext = createMockUserContext({
        followedTopics: ['climate', 'transport'],
      });

      const matchingContent = createMockContent({
        id: 'matching',
        topics: ['climate'],
      });
      const nonMatchingContent = createMockContent({
        id: 'non-matching',
        topics: ['housing'],
      });

      const matchingScore = scoreContent(matchingContent, userContext);
      const nonMatchingScore = scoreContent(nonMatchingContent, userContext);

      expect(matchingScore.scoreBreakdown.topicRelevance).toBeGreaterThan(
        nonMatchingScore.scoreBreakdown.topicRelevance
      );
    });

    it('uses neutral defaults for missing dates, topics, and engagement', () => {
      const result = scoreContent(
        createMockContent({
          createdAt: undefined,
          topics: undefined,
          engagementScore: undefined,
          recentEngagementVelocity: undefined,
        }),
        createMockUserContext()
      );
      expect(result.scoreBreakdown).toMatchObject({
        trending: 0,
        topicRelevance: 0,
        freshness: 10,
        quality: 0,
      });
    });

    it('handles empty topic sets and users who follow no topics', () => {
      expect(
        scoreContent(createMockContent({ topics: [] }), createMockUserContext()).scoreBreakdown
          .topicRelevance
      ).toBe(0);
      expect(
        scoreContent(
          createMockContent({ topics: ['climate'] }),
          createMockUserContext({ followedTopics: [] })
        ).scoreBreakdown.topicRelevance
      ).toBe(0);
    });

    it('caps very large trending and quality signals', () => {
      const result = scoreContent(
        createMockContent({ recentEngagementVelocity: 100_000, engagementScore: 1_000_000 }),
        createMockUserContext()
      );
      expect(result.scoreBreakdown.trending).toBe(35);
      expect(result.scoreBreakdown.quality).toBe(15);
    });

    it('treats negative signals as zero and honors the explicit user-content flag', () => {
      const result = scoreContent(
        createMockContent({
          authorId: 'other-user',
          isUserContent: true,
          recentEngagementVelocity: -1,
          engagementScore: -1,
        }),
        createMockUserContext()
      );
      expect(result.scoreBreakdown.trending).toBe(0);
      expect(result.scoreBreakdown.quality).toBe(0);
      expect(result.scoreBreakdown.userContent).toBe(5);
    });
  });

  describe('scoreAndSortContent', () => {
    it('should return content sorted by score (highest first)', () => {
      const userContext = createMockUserContext();

      const contents = [
        createMockContent({ id: '1', recentEngagementVelocity: 10 }),
        createMockContent({ id: '2', recentEngagementVelocity: 500 }),
        createMockContent({ id: '3', recentEngagementVelocity: 100 }),
      ];

      const result = scoreAndSortContent(contents, userContext);

      // Highest trending should be first
      expect(result[0].content.id).toBe('2');
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      expect(result[1].score).toBeGreaterThanOrEqual(result[2].score);
    });

    it('should handle empty array', () => {
      const userContext = createMockUserContext();
      const result = scoreAndSortContent([], userContext);

      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const userContext = createMockUserContext();
      const contents = [createMockContent()];

      const result = scoreAndSortContent(contents, userContext);

      expect(result).toHaveLength(1);
    });
  });

  describe('getTopScoredContent', () => {
    it('should return top N items', () => {
      const userContext = createMockUserContext();

      const contents = [
        createMockContent({ id: '1', recentEngagementVelocity: 10 }),
        createMockContent({ id: '2', recentEngagementVelocity: 500 }),
        createMockContent({ id: '3', recentEngagementVelocity: 100 }),
        createMockContent({ id: '4', recentEngagementVelocity: 200 }),
        createMockContent({ id: '5', recentEngagementVelocity: 50 }),
      ];

      const result = getTopScoredContent(contents, userContext, 3);

      expect(result).toHaveLength(3);
      // Top 3 should be the highest scoring ones
      expect(result[0].content.id).toBe('2'); // Highest
    });

    it('should return all items if N is greater than array length', () => {
      const userContext = createMockUserContext();
      const contents = [createMockContent(), createMockContent()];

      const result = getTopScoredContent(contents, userContext, 10);

      expect(result).toHaveLength(2);
    });

    it('uses the default limit', () => {
      const contents = Array.from({ length: 25 }, (_, index) =>
        createMockContent({ id: `${index}` })
      );
      expect(getTopScoredContent(contents, createMockUserContext())).toHaveLength(20);
    });
  });

  describe('result grouping and diversity', () => {
    it('separates own, flagged, and public content', () => {
      const context = createMockUserContext();
      const scored = [
        scoreContent(createMockContent({ id: 'own', authorId: 'user-1' }), context),
        scoreContent(
          createMockContent({ id: 'flagged', authorId: 'other', isUserContent: true }),
          context
        ),
        scoreContent(
          createMockContent({ id: 'public', authorId: 'other', isUserContent: false }),
          context
        ),
      ];
      const result = separateScoredContent(scored, context);
      expect(result.userContent.map(item => item.content.id)).toEqual(['own', 'flagged']);
      expect(result.publicContent.map(item => item.content.id)).toEqual(['public']);
    });

    it('penalizes repeated types and sorts the adjusted scores', () => {
      const context = createMockUserContext();
      const makeScored = (id: string, type: ContentItem['type'], score: number) => ({
        ...scoreContent(createMockContent({ id, type }), context),
        score,
      });
      const result = applyDiversityPenalty([
        makeScored('first-amendment', 'amendment', 100),
        makeScored('event', 'event', 95),
        makeScored('second-amendment', 'amendment', 100),
      ]);
      expect(result.map(item => item.content.id)).toEqual([
        'first-amendment',
        'event',
        'second-amendment',
      ]);
      expect(result[2].score).toBe(90);
    });
  });
});
