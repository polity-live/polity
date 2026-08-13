import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedAddComment = vi.hoisted(() => vi.fn());
const sharedVoteComment = vi.hoisted(() => vi.fn());

vi.mock('../../mutators', () => ({
  mutators: {
    documents: {
      addComment: { fn: sharedAddComment },
      voteComment: { fn: sharedVoteComment },
    },
  },
}));

vi.mock('../../server-notify', () => ({
  fireNotification: vi.fn(),
}));

vi.mock('../../server-helpers', () => ({
  amendmentTitle: vi.fn(),
  blogTitle: vi.fn(),
  groupName: vi.fn(),
  recomputeAmendmentCounters: vi.fn(),
  recomputeBlogCounters: vi.fn(),
  userName: vi.fn(),
}));

import { documentServerMutators } from '../server-mutators';

describe('documentServerMutators statement comments', () => {
  beforeEach(() => {
    sharedAddComment.mockReset();
    sharedAddComment.mockResolvedValue(undefined);
    sharedVoteComment.mockReset();
    sharedVoteComment.mockResolvedValue(undefined);
  });

  it('increments a statement comment count exactly once after adding a comment', async () => {
    const tx = {
      location: 'server',
      run: vi
        .fn()
        .mockResolvedValueOnce({ id: 'thread-1', statement_id: 'statement-1' })
        .mockResolvedValueOnce({ id: 'statement-1', comment_count: 4 }),
      mutate: {
        statement: {
          update: vi.fn(),
        },
      },
    };
    const ctx = { userID: 'commenter-1', email: 'commenter@example.com' };
    const args = {
      id: 'comment-1',
      thread_id: 'thread-1',
      parent_id: null,
      content: 'A comment',
      user_id: 'commenter-1',
      upvotes: 0,
      downvotes: 0,
    };

    await documentServerMutators.addComment.fn({
      tx: tx as never,
      ctx,
      args,
    });

    expect(sharedAddComment).toHaveBeenCalledOnce();
    expect(tx.mutate.statement.update).toHaveBeenCalledOnce();
    expect(tx.mutate.statement.update).toHaveBeenCalledWith({
      id: 'statement-1',
      comment_count: 5,
      updated_at: expect.any(Number),
    });
  });

  it('recomputes comment vote counters on the server after a vote', async () => {
    const tx = {
      location: 'server',
      run: vi.fn().mockResolvedValue([
        { id: 'vote-1', vote: 1 },
        { id: 'vote-2', vote: 1 },
        { id: 'vote-3', vote: -1 },
      ]),
      mutate: {
        comment: {
          update: vi.fn(),
        },
      },
    };
    const ctx = { userID: 'voter-1', email: 'voter@example.com' };
    const args = {
      id: 'vote-1',
      comment_id: 'comment-1',
      user_id: 'voter-1',
      vote: 1,
    };

    await documentServerMutators.voteComment.fn({
      tx: tx as never,
      ctx,
      args,
    });

    expect(sharedVoteComment).toHaveBeenCalledOnce();
    expect(tx.mutate.comment.update).toHaveBeenCalledWith({
      id: 'comment-1',
      upvotes: 2,
      downvotes: 1,
      updated_at: expect.any(Number),
    });
  });
});
