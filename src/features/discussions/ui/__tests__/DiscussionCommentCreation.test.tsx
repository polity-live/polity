/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCommentTreeController } from '../useCommentTreeController';
import { useThreadCardController } from '../useThreadCardController';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const votingActions = {
  onVoteComment: vi.fn(async () => undefined),
  onVoteThread: vi.fn(async () => undefined),
};

describe('discussion comment creation controllers', () => {
  it('stores the created root comment ID and closes the form after client apply', async () => {
    const onCreateComment = vi.fn(async () => 'comment-new');
    const { result } = renderHook(() =>
      useThreadCardController({
        thread: {
          id: 'thread-1',
          content: 'Discussion',
          created_at: 1,
          updated_at: 1,
          user_id: 'author-1',
          document_id: null,
          amendment_id: 'amendment-1',
          statement_id: null,
          blog_id: null,
          todo_id: null,
          status: 'open',
          resolved_at: null,
          upvotes: 0,
          downvotes: 0,
          position: null,
          user: undefined,
          votes: [],
          comments: [],
        },
        userId: 'user-1',
        onCreateComment,
        ...votingActions,
      })
    );

    act(() => {
      result.current.setIsCommenting(true);
      result.current.setCommentText('New root comment');
    });
    await act(async () => {
      await result.current.handleAddComment();
    });

    expect(onCreateComment).toHaveBeenCalledWith(
      'thread-1',
      'New root comment',
      'user-1',
      undefined
    );
    expect(result.current.createdCommentId).toBe('comment-new');
    expect(result.current.commentText).toBe('');
    expect(result.current.isCommenting).toBe(false);
  });

  it('stores the created reply ID and closes the reply form after client apply', async () => {
    const onCreateComment = vi.fn(async () => 'reply-new');
    const { result } = renderHook(() =>
      useCommentTreeController({
        comment: {
          id: 'comment-1',
          thread_id: 'thread-1',
          user_id: 'author-1',
          parent_id: null,
          content: 'Parent comment',
          upvotes: 0,
          downvotes: 0,
          created_at: 1,
          updated_at: 1,
          user: undefined,
          votes: [],
          parent: undefined,
          replies: [],
        },
        threadId: 'thread-1',
        userId: 'user-1',
        onCreateComment,
        onVoteComment: votingActions.onVoteComment,
      })
    );

    act(() => {
      result.current.setIsReplying(true);
      result.current.setReplyText('New reply');
    });
    await act(async () => {
      await result.current.handleReply();
    });

    expect(onCreateComment).toHaveBeenCalledWith('thread-1', 'New reply', 'user-1', 'comment-1');
    expect(result.current.createdReplyId).toBe('reply-new');
    expect(result.current.replyText).toBe('');
    expect(result.current.isReplying).toBe(false);
  });
});
