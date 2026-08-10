/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommentItemController } from '../useCommentItemController';

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    creator: { id: 'user-1' },
    votes: [
      { id: 'up', vote: 1, user: { id: 'user-1' } },
      { id: 'down', vote: -1, user: { id: 'user-2' } },
    ],
    ...overrides,
  } as never;
}

describe('useCommentItemController', () => {
  it('derives vote, score, and ownership state from votes', () => {
    const { result } = renderHook(() =>
      useCommentItemController({
        comment: comment(),
        currentUserId: 'user-1',
        onVote: vi.fn(),
        onReply: vi.fn(),
      })
    );
    expect(result.current.hasUpvoted).toBe(true);
    expect(result.current.hasDownvoted).toBe(false);
    expect(result.current.score).toBe(0);
    expect(result.current.isOwner).toBe(true);
  });

  it('uses explicit and empty vote totals', async () => {
    const explicit = renderHook(() =>
      useCommentItemController({
        comment: comment({ upvotes: 5, downvotes: 2, votes: undefined }),
        onVote: vi.fn(),
        onReply: vi.fn(),
      })
    );
    expect(explicit.result.current.score).toBe(3);
    expect(explicit.result.current.isOwner).toBe(false);
    explicit.unmount();
    const empty = renderHook(() =>
      useCommentItemController({
        comment: comment({ creator: undefined, votes: undefined }),
        onVote: vi.fn(),
        onReply: vi.fn(),
      })
    );
    expect(empty.result.current.score).toBe(0);
    await act(() => empty.result.current.onVote(1));
  });

  it('submits votes once at a time and always clears voting state', async () => {
    let resolveVote!: () => void;
    const onVote = vi.fn(() => new Promise<void>(resolve => (resolveVote = resolve)));
    const { result } = renderHook(() =>
      useCommentItemController({
        comment: comment(),
        currentUserId: 'user-1',
        onVote,
        onReply: vi.fn(),
      })
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.onVote(-1);
      void result.current.onVote(1);
    });
    expect(result.current.isVoting).toBe(true);
    expect(onVote).toHaveBeenCalledOnce();
    expect(onVote).toHaveBeenCalledWith('comment-1', -1, { id: 'up', vote: 1 });
    await act(async () => {
      resolveVote();
      await pending;
    });
    expect(result.current.isVoting).toBe(false);
  });

  it('handles replies and all local UI toggles', async () => {
    const onReply = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useCommentItemController({ comment: comment(), onVote: vi.fn(), onReply })
    );
    act(() => result.current.onToggleReplyInput());
    expect(result.current.showReplyInput).toBe(true);
    await act(() => result.current.onReplySubmit('Reply'));
    expect(onReply).toHaveBeenCalledWith('comment-1', 'Reply');
    expect(result.current.showReplyInput).toBe(false);
    act(() => result.current.onToggleReplyInput());
    act(() => result.current.onCancelReply());
    expect(result.current.showReplyInput).toBe(false);
    act(() => result.current.onToggleReplyInput());
    act(() => result.current.onToggleCollapsed());
    expect(result.current.showReplyInput).toBe(false);
    expect(result.current.isCollapsed).toBe(true);
    act(() => result.current.onToggleCollapsed());
    expect(result.current.isCollapsed).toBe(false);
  });
});
