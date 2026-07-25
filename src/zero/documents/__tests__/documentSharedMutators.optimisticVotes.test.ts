import { describe, expect, it, vi } from 'vitest';

import { documentSharedMutators } from '../shared-mutators';

const ctx = { userID: 'user-1', email: 'user@example.com' };

function createClientTx(rows: unknown[]) {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: 'client' as const,
    run: vi.fn().mockImplementation(() => Promise.resolve(rows.shift())),
    mutate: {
      thread: { update: vi.fn() },
      comment: { update: vi.fn() },
      thread_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      comment_vote: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

describe('documentSharedMutators optimistic vote counters', () => {
  it('increments a thread upvote counter when creating a vote', async () => {
    const tx = createClientTx([{ id: 'thread-1', upvotes: 4, downvotes: 2 }]);

    await documentSharedMutators.voteThread.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'vote-1',
        thread_id: 'thread-1',
        user_id: 'user-1',
        vote: 1,
      },
    });

    expect(tx.mutate.thread.update).toHaveBeenCalledWith({
      id: 'thread-1',
      upvotes: 5,
      downvotes: 2,
    });
  });

  it('moves a changed thread vote between both counters', async () => {
    const tx = createClientTx([
      { id: 'vote-1', thread_id: 'thread-1', vote: 1 },
      { id: 'thread-1', upvotes: 4, downvotes: 2 },
    ]);

    await documentSharedMutators.updateThreadVote.fn({
      tx: tx as never,
      ctx,
      args: { id: 'vote-1', vote: -1 },
    });

    expect(tx.mutate.thread.update).toHaveBeenCalledWith({
      id: 'thread-1',
      upvotes: 3,
      downvotes: 3,
    });
  });

  it('decrements a thread counter when removing a vote', async () => {
    const tx = createClientTx([
      { id: 'vote-1', thread_id: 'thread-1', vote: -1 },
      { id: 'thread-1', upvotes: 4, downvotes: 2 },
    ]);

    await documentSharedMutators.deleteThreadVote.fn({
      tx: tx as never,
      ctx,
      args: { id: 'vote-1' },
    });

    expect(tx.mutate.thread.update).toHaveBeenCalledWith({
      id: 'thread-1',
      upvotes: 4,
      downvotes: 1,
    });
  });

  it('increments a comment downvote counter when creating a vote', async () => {
    const tx = createClientTx([{ id: 'comment-1', upvotes: 3, downvotes: 1 }]);

    await documentSharedMutators.voteComment.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'vote-1',
        comment_id: 'comment-1',
        user_id: 'user-1',
        vote: -1,
      },
    });

    expect(tx.mutate.comment.update).toHaveBeenCalledWith({
      id: 'comment-1',
      upvotes: 3,
      downvotes: 2,
    });
  });

  it('moves a changed comment vote between both counters', async () => {
    const tx = createClientTx([
      { id: 'vote-1', comment_id: 'comment-1', vote: -1 },
      { id: 'comment-1', upvotes: 3, downvotes: 2 },
    ]);

    await documentSharedMutators.updateCommentVote.fn({
      tx: tx as never,
      ctx,
      args: { id: 'vote-1', vote: 1 },
    });

    expect(tx.mutate.comment.update).toHaveBeenCalledWith({
      id: 'comment-1',
      upvotes: 4,
      downvotes: 1,
    });
  });

  it('decrements a comment counter when removing a vote', async () => {
    const tx = createClientTx([
      { id: 'vote-1', comment_id: 'comment-1', vote: 1 },
      { id: 'comment-1', upvotes: 3, downvotes: 2 },
    ]);

    await documentSharedMutators.deleteCommentVote.fn({
      tx: tx as never,
      ctx,
      args: { id: 'vote-1' },
    });

    expect(tx.mutate.comment.update).toHaveBeenCalledWith({
      id: 'comment-1',
      upvotes: 2,
      downvotes: 2,
    });
  });
});
