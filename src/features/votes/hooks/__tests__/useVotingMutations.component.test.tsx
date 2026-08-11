/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useVotingMutations } from '../useVotingMutations';

const mocks = vi.hoisted(() => ({
  actions: {
    deleteThreadVote: vi.fn(),
    updateThreadVote: vi.fn(),
    voteThread: vi.fn(),
    deleteCommentVote: vi.fn(),
    updateCommentVote: vi.fn(),
    voteComment: vi.fn(),
  },
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toastError: vi.fn(),
}));

vi.mock('@/zero/documents', () => ({ useDocumentActions: () => mocks.actions }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(args[0]),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(mocks.actions)) action.mockResolvedValue(undefined);
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
});

describe('useVotingMutations', () => {
  it('inserts, changes, and removes thread votes while rejecting anonymous voting', async () => {
    const { result } = renderHook(() => useVotingMutations());
    await act(async () => result.current.voteOnThread('thread-1', 1, undefined, 0, 0));
    expect(mocks.toastError).toHaveBeenCalledOnce();

    await act(async () => result.current.voteOnThread('thread-1', 1, undefined, 0, 0, 'user-1'));
    expect(mocks.actions.voteThread).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      vote: 1,
      thread_id: 'thread-1',
      user_id: 'user-1',
    });
    await act(async () =>
      result.current.voteOnThread('thread-1', -1, { id: 'vote-1', vote: 1 }, 0, 0, 'user-1')
    );
    expect(mocks.actions.updateThreadVote).toHaveBeenCalledWith({ id: 'vote-1', vote: -1 });
    await act(async () =>
      result.current.voteOnThread('thread-1', 1, { id: 'vote-1', vote: 1 }, 0, 0, 'user-1')
    );
    expect(mocks.actions.deleteThreadVote).toHaveBeenCalledWith('vote-1');
  });

  it('inserts, changes, and removes comment votes through the same client-apply boundary', async () => {
    const { result } = renderHook(() => useVotingMutations());
    await act(async () => result.current.voteOnComment('comment-1', 1, undefined, 0, 0, 'user-1'));
    expect(mocks.actions.voteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 'comment-1', user_id: 'user-1', vote: 1 })
    );
    await act(async () =>
      result.current.voteOnComment(
        'comment-1',
        -1,
        { id: 'comment-vote-1', vote: 1 },
        0,
        0,
        'user-1'
      )
    );
    expect(mocks.actions.updateCommentVote).toHaveBeenCalledWith({
      id: 'comment-vote-1',
      vote: -1,
    });
    await act(async () =>
      result.current.voteOnComment(
        'comment-1',
        1,
        { id: 'comment-vote-1', vote: 1 },
        0,
        0,
        'user-1'
      )
    );
    expect(mocks.actions.deleteCommentVote).toHaveBeenCalledWith('comment-vote-1');
    expect(mocks.waitForClientApply).toHaveBeenCalledTimes(3);
  });

  it('rejects anonymous comment voting and rethrows thread and comment mutation failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useVotingMutations());
    await act(async () => result.current.voteOnComment('comment-1', 1, undefined));
    expect(mocks.toastError).toHaveBeenCalledOnce();

    const threadFailure = new Error('thread failed');
    mocks.actions.voteThread.mockRejectedValueOnce(threadFailure);
    await expect(
      act(async () => result.current.voteOnThread('thread-1', 1, undefined, 0, 0, 'user-1'))
    ).rejects.toBe(threadFailure);

    const commentFailure = new Error('comment failed');
    mocks.actions.voteComment.mockRejectedValueOnce(commentFailure);
    await expect(
      act(async () => result.current.voteOnComment('comment-1', 1, undefined, 0, 0, 'user-1'))
    ).rejects.toBe(commentFailure);
    expect(consoleError).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
