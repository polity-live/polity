import { describe, expect, it, vi } from 'vitest';

import { buildUserWikiContentItems } from '../buildUserWikiContentItems';

const mocks = vi.hoisted(() => ({
  getMembershipRoleNames: vi.fn(
    (membership: { roleNames?: string[] }) => membership.roleNames ?? []
  ),
  richTextToPlainText: vi.fn((value: unknown) => (value == null ? '' : String(value))),
  extractHashtagTags: vi.fn((value: unknown) =>
    Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : []
  ),
  getStatementHeadline: vi.fn(
    (statement: { headline?: string }, text: string) => statement.headline ?? text
  ),
  getOrderedBranches: vi.fn((branches: unknown[]) => branches),
  buildSearchText: vi.fn((...values: unknown[]) =>
    values
      .flat(Infinity)
      .filter(value => value != null && value !== '')
      .join(' ')
  ),
}));

vi.mock('@/features/shared/logic/membershipRoleHelpers', () => ({
  getMembershipRoleNames: (membership: { roleNames?: string[] }) =>
    mocks.getMembershipRoleNames(membership),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => mocks.richTextToPlainText(value),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: (value: unknown) => mocks.extractHashtagTags(value),
}));

vi.mock('@/zero/statements/content', () => ({
  getStatementHeadline: (statement: { headline?: string }, text: string) =>
    mocks.getStatementHeadline(statement, text),
}));

vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getOrderedBranches: (branches: unknown[]) => mocks.getOrderedBranches(branches),
}));

vi.mock('../userWikiSearch', () => ({
  buildSearchText: (...values: unknown[]) => mocks.buildSearchText(...values),
}));

describe('buildUserWikiContentItems', () => {
  it('returns an empty list for absent profile relations', () => {
    expect(
      buildUserWikiContentItems({
        user: { id: 'user-1' } as never,
        authorName: 'Ada',
        authorAvatar: 'avatar.png',
      })
    ).toEqual([]);
  });

  it('normalizes, deduplicates and sorts all supported profile content', () => {
    const fixedDate = new Date('2026-07-01T10:00:00.000Z');
    const amendment = {
      id: 'amendment-1',
      title: 'Climate motion',
      reason: 'Because',
      preamble: 'Preamble',
      amendment_hashtags: ['climate'],
      tags: ['ignored', 2],
      created_at: fixedDate,
      group: { id: 'group-1', name: 'Greens' },
      current_process_run: { branches: [{ editing_mode: 'edit' }] },
      collaborators: [{ id: 'one' }],
      change_requests: [{ id: 'request' }],
      comment_count: 2,
      vote_entries: [{ id: 'vote' }],
      code: 'A-1',
    };
    const blog = {
      id: 'blog-1',
      title: 'News',
      description: 'Blog description',
      image_url: 'blog.png',
      created_at: '2026-08-02T10:00:00.000Z',
      date: '2026-08-02',
      blog_hashtags: ['news'],
      group_id: 'group-1',
      comment_count: 3,
    };
    const group = {
      id: 'group-1',
      name: 'Greens',
      description: 'Group description',
      created_at: 1_785_581_600_000,
      group_hashtags: ['politics'],
      member_count: 12,
      event_count: 4,
      amendment_count: 5,
      events: [{ id: 'ignored-event' }],
      amendments: [{ id: 'ignored-amendment' }],
    };
    const statement = {
      id: 'statement-1',
      headline: 'Statement headline',
      text: 'Statement text',
      image_url: 'statement.png',
      video_url: 'statement.mp4',
      created_at: '2026-08-03T10:00:00.000Z',
      statement_hashtags: ['statement'],
      group_id: 'group-1',
      group: { name: 'Greens', image_url: 'group.png' },
      comment_count: 4,
      support_votes: [{ vote: 1 }, { vote: -1 }, { vote: 0 }],
      surveys: [
        {
          question: 'Choose?',
          options: [
            { label: 'One', votes: [{ id: 'vote' }] },
            { label: 'Two', votes: null },
          ],
        },
      ],
    };

    const items = buildUserWikiContentItems({
      user: {
        id: 'user-1',
        amendment_collaborations: [
          { amendment: null },
          { amendment },
          { amendment },
          {
            amendment: {
              id: 'amendment-2',
              title: null,
              reason: null,
              preamble: null,
              amendment_hashtags: [],
              tags: null,
              created_at: null,
              current_process_run: null,
              upvotes: 0,
            },
          },
        ],
        blogger_relations: [
          { blog: null },
          { blog },
          { blog },
          {
            blog: {
              id: 'blog-2',
              title: null,
              description: '',
              created_at: 1_000,
              blog_hashtags: null,
              group_id: null,
              comment_count: null,
            },
          },
        ],
        group_memberships: [
          { group: null },
          { group, roleNames: ['Admin', 'Member'] },
          { group, roleNames: ['Duplicate'] },
          {
            group: {
              id: 'group-2',
              name: null,
              description: '',
              created_at: null,
              group_hashtags: null,
              member_count: null,
              events: [{ id: 'event-1' }],
              amendments: [{ id: 'amendment-1' }, { id: 'amendment-2' }],
            },
          },
        ],
        statements: [
          statement,
          {
            id: 'statement-2',
            text: '',
            created_at: fixedDate,
            statement_hashtags: null,
            group_id: null,
            group: null,
            comment_count: null,
            support_votes: null,
            surveys: [],
          },
        ],
      } as never,
      authorName: 'Ada',
      authorAvatar: 'avatar.png',
    });

    expect(items.map(item => item.id)).toEqual([
      'statement-1',
      'blog-1',
      'group-1',
      'amendment-1',
      'statement-2',
      'blog-2',
      'amendment-2',
      'group-2',
    ]);
    expect(items.find(item => item.id === 'amendment-1')).toMatchObject({
      type: 'amendment',
      description: 'Because',
      tags: ['climate'],
      status: 'edit',
      collaboratorCount: 1,
      changeRequestCount: 1,
      stats: { reactions: 1, comments: 2 },
    });
    expect(items.find(item => item.id === 'amendment-2')).toMatchObject({
      title: '',
      description: undefined,
      tags: [],
      status: null,
      createdAt: new Date(0),
    });
    expect(items.find(item => item.id === 'blog-1')).toMatchObject({
      authorId: 'user-1',
      authorName: 'Ada',
      authorAvatar: 'avatar.png',
      groupId: 'group-1',
    });
    expect(items.find(item => item.id === 'group-1')).toMatchObject({
      memberCount: 12,
      eventCount: 4,
      amendmentCount: 5,
      stats: { members: 12 },
    });
    expect(items.find(item => item.id === 'group-2')).toMatchObject({
      memberCount: undefined,
      eventCount: 1,
      amendmentCount: 2,
    });
    expect(items.find(item => item.id === 'statement-1')).toMatchObject({
      title: 'Statement headline',
      upvotes: 1,
      downvotes: 1,
      surveyQuestion: 'Choose?',
      surveyOptions: [
        { label: 'One', voteCount: 1 },
        { label: 'Two', voteCount: 0 },
      ],
      stats: { reactions: 3, comments: 4 },
    });
    expect(items.find(item => item.id === 'statement-2')).toMatchObject({
      surveyQuestion: undefined,
      surveyOptions: undefined,
      upvotes: 0,
      downvotes: 0,
    });
  });
});
