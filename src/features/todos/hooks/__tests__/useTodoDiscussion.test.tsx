/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTodoDiscussion } from '../useTodoDiscussion';

const actions = vi.hoisted(() => ({
  addComment: vi.fn(),
  voteComment: vi.fn(),
  updateCommentVote: vi.fn(),
  deleteCommentVote: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-current' } }),
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => actions,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  Object.values(actions).forEach(mock => mock.mockReset());
  actions.addComment.mockReturnValue({});
  actions.voteComment.mockReturnValue({});
  actions.updateCommentVote.mockReturnValue({});
  actions.deleteCommentVote.mockReturnValue({});
});

describe('useTodoDiscussion', () => {
  const todo = {
    threads: [
      {
        id: 'thread-1',
        comments: [
          {
            id: 'comment-1',
            content: 'Top level',
            parent_id: null,
            created_at: 100,
            upvotes: 8,
            downvotes: 2,
            user: {
              id: 'user-author',
              first_name: 'Ada',
              last_name: 'Lovelace',
              handle: 'ada',
              avatar: null,
            },
            votes: [{ id: 'vote-1', vote: 1, user: { id: 'user-current' } }],
            replies: [
              {
                id: 'reply-1',
                content: 'Reply',
                parent_id: 'comment-1',
                created_at: 101,
                upvotes: 3,
                downvotes: 1,
                user: null,
                votes: [],
                replies: [],
              },
            ],
          },
        ],
      },
    ],
  };

  it('maps the single todo thread including replies and count', () => {
    const { result } = renderHook(() => useTodoDiscussion(todo));

    expect(result.current.commentCount).toBe(2);
    expect(result.current.comments[0]).toMatchObject({
      id: 'comment-1',
      text: 'Top level',
      upvotes: 8,
      downvotes: 2,
      creator: { id: 'user-author', name: 'Ada Lovelace', handle: 'ada' },
      replies: [{ id: 'reply-1', text: 'Reply', upvotes: 3, downvotes: 1 }],
    });
  });

  it('adds replies to the existing todo thread', async () => {
    const { result } = renderHook(() => useTodoDiscussion(todo));

    await act(() => result.current.onAddComment(' A reply ', 'comment-1'));

    expect(actions.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_id: 'thread-1',
        parent_id: 'comment-1',
        content: 'A reply',
        user_id: 'user-current',
      })
    );
  });

  it('creates, changes and retracts the current user vote', async () => {
    const { result } = renderHook(() => useTodoDiscussion(todo));

    await act(() => result.current.onVote('comment-1', 1));
    await act(() => result.current.onVote('comment-1', -1, { id: 'vote-1', vote: 1 }));
    await act(() => result.current.onVote('comment-1', 1, { id: 'vote-1', vote: 1 }));

    expect(actions.voteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 'comment-1', vote: 1, user_id: 'user-current' })
    );
    expect(actions.updateCommentVote).toHaveBeenCalledWith({ id: 'vote-1', vote: -1 });
    expect(actions.deleteCommentVote).toHaveBeenCalledWith('vote-1');
  });
});
