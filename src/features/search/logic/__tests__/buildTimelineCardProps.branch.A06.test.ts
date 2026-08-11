import { describe, expect, it } from 'vitest';

import { buildTimelineCardProps } from '../buildTimelineCardProps';

const createdAt = new Date('2026-08-09T12:00:00.000Z');

function build(item: Record<string, unknown>) {
  return buildTimelineCardProps({ id: 'id', title: 'Title', createdAt, ...item } as any);
}

describe('buildTimelineCardProps exhaustive branches', () => {
  it('builds group, event, amendment, blog, todo, payment and user cards', () => {
    expect(build({ type: 'group', groupId: 'group', memberCount: 3 }).cardProps).toMatchObject({
      group: { id: 'group', memberCount: 3 },
    });
    expect(build({ type: 'group', stats: { members: 7 } }).cardProps).toMatchObject({
      group: { id: 'id', memberCount: 7 },
    });

    expect(
      build({
        type: 'event',
        eventId: 'event',
        startDate: new Date('2026-08-10T00:00:00Z'),
        tags: ['one'],
        authorName: 'Name',
        authorId: 'author',
      }).cardProps
    ).toMatchObject({
      event: {
        id: 'event',
        hashtags: [{ id: 'one', tag: 'one' }],
        organizerName: 'Name',
        organizerId: 'author',
      },
    });
    expect(build({ type: 'event', authorId: 'author' }).cardProps).toMatchObject({
      event: { id: 'id', startDate: createdAt, hashtags: [], organizerName: 'author' },
    });
    expect(build({ type: 'event' }).cardProps).toMatchObject({
      event: { organizerName: undefined, organizerId: undefined },
    });

    expect(build({ type: 'amendment', status: null }).cardProps).toMatchObject({
      amendment: { hashtags: [] },
    });
    expect(build({ type: 'amendment', status: 'adopted', tags: ['tag'] }).cardProps).toMatchObject({
      amendment: { hashtags: [{ id: 'tag', tag: 'tag' }] },
    });

    expect(build({ type: 'blog', commentCount: 4, tags: ['blog'] }).cardProps).toMatchObject({
      blog: { commentCount: 4, hashtags: [{ id: 'blog', tag: 'blog' }] },
    });
    expect(build({ type: 'blog', stats: { comments: 6 } }).cardProps).toMatchObject({
      blog: { commentCount: 6, hashtags: [] },
    });
    expect(build({ type: 'todo' }).cardType).toBe('todo');
    expect(build({ type: 'payment' }).cardType).toBe('payment');
    expect(build({ type: 'user', tags: ['user'] }).cardProps).toMatchObject({
      user: { hashtags: [{ id: 'user', tag: 'user' }] },
    });
    expect(build({ type: 'user' }).cardProps).toMatchObject({ user: { hashtags: [] } });
  });

  it('covers statement content, author and counter fallbacks', () => {
    expect(
      build({
        type: 'statement',
        description: 'Body',
        authorName: 'Author',
        upvotes: 2,
        downvotes: 3,
        commentCount: 4,
        tags: ['statement'],
      }).cardProps
    ).toMatchObject({
      statement: {
        content: 'Body',
        authorName: 'Author',
        supportCount: 2,
        opposeCount: 3,
        commentCount: 4,
        hashtags: [{ id: 'statement', tag: 'statement' }],
      },
    });
    expect(
      build({ type: 'statement', description: '', authorId: 'author', stats: { comments: 9 } })
        .cardProps
    ).toMatchObject({
      statement: {
        content: 'Title',
        authorName: 'author',
        supportCount: 0,
        opposeCount: 0,
        commentCount: 9,
        hashtags: [],
      },
    });
    expect(build({ type: 'statement', authorName: '', authorId: '' }).cardProps).toMatchObject({
      statement: { authorName: '' },
    });
  });

  it('builds vote, election, video and image variants and rejects unsupported cards', () => {
    expect(
      build({
        type: 'vote',
        stats: { reactions: 3, comments: 1 },
        status: null,
        endDate: '2026-08-10',
      }).cardProps
    ).toMatchObject({ vote: { supportPercentage: 75, supportCount: 3, opposeCount: 1 } });
    const updatedAt = new Date('2026-08-09T13:00:00Z');
    expect(build({ type: 'vote', updatedAt }).cardProps).toMatchObject({
      vote: { endTime: updatedAt, supportPercentage: 0, supportCount: 0, opposeCount: 0 },
    });
    expect(build({ type: 'vote' }).cardProps).toMatchObject({ vote: { endTime: createdAt } });

    expect(
      build({ type: 'election', status: null, candidates: ['one'], totalCandidates: 1 }).cardProps
    ).toMatchObject({ election: { candidates: ['one'], totalCandidates: 1 } });
    expect(
      build({ type: 'election', candidates: null, totalCandidates: 0 }).cardProps
    ).toMatchObject({ election: { candidates: [], totalCandidates: 0 } });
    expect(build({ type: 'video' }).cardType).toBe('video');
    expect(build({ type: 'image', imageUrl: null })).toEqual({ cardType: null, cardProps: null });
    expect(build({ type: 'image', imageUrl: '/image.png' }).cardType).toBe('image');
    expect(build({ type: 'unsupported' })).toEqual({ cardType: null, cardProps: null });
  });
});
