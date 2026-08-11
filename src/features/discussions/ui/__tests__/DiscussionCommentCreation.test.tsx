/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCommentTreeController } from '../useCommentTreeController';
import { useThreadCardController } from '../useThreadCardController';

const feedback = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: feedback.toastError },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const votingActions = {
  onVoteComment: vi.fn(async () => undefined),
  onVoteThread: vi.fn(async () => undefined),
};

function thread(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  } as never;
}

function comment(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  } as never;
}

describe('discussion comment creation controllers', () => {
  it('stores the created root comment ID and closes the form after client apply', async () => {
    const onCreateComment = vi.fn(async () => 'comment-new');
    const { result } = renderHook(() =>
      useThreadCardController({
        thread: thread(),
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
        comment: comment(),
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

  it('guards anonymous, duplicate, and failed thread votes while preserving vote metadata', async () => {
    let releaseVote!: () => void;
    const pendingVote = new Promise<void>(resolve => {
      releaseVote = resolve;
    });
    const onVoteThread = vi.fn(() => pendingVote);
    const { result, rerender } = renderHook(
      ({ userId }) =>
        useThreadCardController({
          thread: thread({
            upvotes: 4,
            downvotes: 2,
            comments: undefined,
            votes: [{ id: 'vote-1', vote: 1, user: { id: 'user-1' } }],
          }),
          userId,
          onCreateComment: vi.fn(),
          onVoteThread,
          onVoteComment: votingActions.onVoteComment,
        }),
      { initialProps: { userId: undefined as string | undefined } }
    );

    expect(result.current.sortedComments).toEqual([]);
    await act(async () => result.current.handleVote(1));
    expect(onVoteThread).not.toHaveBeenCalled();
    expect(feedback.toastError).toHaveBeenCalledWith(
      'generated.inline.0138_please_log_in_to_vote_59574e84'
    );

    rerender({ userId: 'user-1' });
    expect(result.current).toMatchObject({ score: 2, hasUpvoted: true, hasDownvoted: false });
    let firstVote!: Promise<void>;
    act(() => {
      firstVote = result.current.handleVote(-1);
      void result.current.handleVote(1);
    });
    expect(onVoteThread).toHaveBeenCalledOnce();
    expect(onVoteThread).toHaveBeenCalledWith(
      'thread-1',
      -1,
      expect.objectContaining({ id: 'vote-1' }),
      4,
      2,
      'user-1'
    );
    releaseVote();
    await act(async () => firstVote);
    expect(result.current.isVoting).toBe(false);

    onVoteThread.mockRejectedValueOnce(new Error('vote failed'));
    await act(async () => result.current.handleVote(1));
    expect(feedback.toastError).toHaveBeenLastCalledWith(
      'generated.inline.0140_failed_to_vote_68d9f4e2'
    );
  });

  it('guards invalid root comments and clears submission state after create failures', async () => {
    const onCreateComment = vi.fn().mockRejectedValue(new Error('create failed'));
    const { result, rerender } = renderHook(
      ({ userId }) =>
        useThreadCardController({
          thread: thread(),
          userId,
          onCreateComment,
          ...votingActions,
        }),
      { initialProps: { userId: 'user-1' as string | undefined } }
    );

    await act(async () => result.current.handleAddComment());
    expect(onCreateComment).not.toHaveBeenCalled();
    act(() => result.current.setCommentText('Comment'));
    rerender({ userId: undefined });
    await act(async () => result.current.handleAddComment());
    expect(onCreateComment).not.toHaveBeenCalled();

    rerender({ userId: 'user-1' });
    await act(async () => result.current.handleAddComment());
    expect(onCreateComment).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('passes zero vote totals through both discussion voting controllers', async () => {
    const onVoteThread = vi.fn(async () => undefined);
    const threadController = renderHook(() =>
      useThreadCardController({
        thread: thread({ upvotes: 0, downvotes: 0 }),
        userId: 'user-1',
        onCreateComment: vi.fn(),
        onVoteThread,
        onVoteComment: vi.fn(),
      })
    );
    await act(async () => threadController.result.current.handleVote(1));
    expect(onVoteThread).toHaveBeenCalledWith('thread-1', 1, undefined, 0, 0, 'user-1');

    const onVoteComment = vi.fn(async () => undefined);
    const commentController = renderHook(() =>
      useCommentTreeController({
        comment: comment({ upvotes: 0, downvotes: 0 }),
        threadId: 'thread-1',
        userId: 'user-1',
        onCreateComment: vi.fn(),
        onVoteComment,
      })
    );
    await act(async () => commentController.result.current.handleVote(-1));
    expect(onVoteComment).toHaveBeenCalledWith('comment-1', -1, undefined, 0, 0, 'user-1');
  });

  it('covers comment collapse, anonymous voting, duplicate voting, and rejected replies', async () => {
    let rejectVote!: (error: Error) => void;
    const pendingVote = new Promise<void>((_resolve, reject) => {
      rejectVote = reject;
    });
    const onVoteComment = vi.fn(() => pendingVote);
    const onCreateComment = vi.fn().mockRejectedValue(new Error('reply failed'));
    const { result, rerender } = renderHook(
      ({ userId }) =>
        useCommentTreeController({
          comment: comment({
            upvotes: 3,
            downvotes: 1,
            votes: [{ id: 'vote-1', vote: -1, user: { id: 'user-1' } }],
          }),
          threadId: 'thread-1',
          userId,
          onCreateComment,
          onVoteComment,
        }),
      { initialProps: { userId: undefined as string | undefined } }
    );

    act(() => result.current.onToggleCollapsed());
    expect(result.current.isCollapsed).toBe(true);
    await act(async () => result.current.handleVote(1));
    expect(onVoteComment).not.toHaveBeenCalled();

    rerender({ userId: 'user-1' });
    expect(result.current).toMatchObject({ score: 2, hasUpvoted: false, hasDownvoted: true });
    let firstVote!: Promise<void>;
    act(() => {
      firstVote = result.current.handleVote(1);
      void result.current.handleVote(-1);
    });
    expect(onVoteComment).toHaveBeenCalledOnce();
    rejectVote(new Error('vote failed'));
    await act(async () => firstVote);
    expect(result.current.isVoting).toBe(false);
    expect(feedback.toastError).toHaveBeenLastCalledWith(
      'generated.inline.0140_failed_to_vote_68d9f4e2'
    );

    await act(async () => result.current.handleReply());
    expect(onCreateComment).not.toHaveBeenCalled();
    act(() => result.current.setReplyText('Reply'));
    rerender({ userId: undefined });
    await act(async () => result.current.handleReply());
    expect(onCreateComment).not.toHaveBeenCalled();
    rerender({ userId: 'user-1' });
    await act(async () => result.current.handleReply());
    expect(onCreateComment).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(false);
  });
});
