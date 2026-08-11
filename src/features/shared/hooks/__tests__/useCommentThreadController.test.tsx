/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommentThreadController } from '../useCommentThreadController';

const comments = [
  { id: 'direct', createdAt: 1, upvotes: 4, downvotes: 1 },
  {
    id: 'derived',
    createdAt: 3,
    votes: [{ vote: 1 }, { vote: -1 }, { vote: 1 }],
  },
  { id: 'empty', createdAt: 0 },
  { id: 'reply', parent_id: 'direct', createdAt: 4 },
] as any;

describe('useCommentThreadController', () => {
  it('derives vote totals when direct counters are absent', () => {
    const view = renderHook(() =>
      useCommentThreadController({ comments, onAddComment: vi.fn().mockResolvedValue(undefined) })
    );

    expect(view.result.current.threadedComments.map(comment => comment.id)).toEqual([
      'direct',
      'derived',
      'empty',
    ]);
  });

  it('supports controlled chronological sorting and comment actions', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const onSortChange = vi.fn();
    const view = renderHook(() =>
      useCommentThreadController({
        comments,
        onAddComment,
        onSortChange,
        sortBy: 'time',
      })
    );

    expect(view.result.current.threadedComments.map(comment => comment.id)).toEqual([
      'derived',
      'direct',
      'empty',
    ]);
    act(() => view.result.current.onSortChange('votes'));
    expect(onSortChange).toHaveBeenCalledWith('votes');
    act(() => view.result.current.setIsCommenting(true));
    await act(async () => view.result.current.onReply('direct', 'reply'));
    await act(async () => view.result.current.onAddRootComment('root'));
    expect(onAddComment).toHaveBeenNthCalledWith(1, 'reply', 'direct');
    expect(onAddComment).toHaveBeenNthCalledWith(2, 'root');
    expect(view.result.current.isCommenting).toBe(false);
  });
});
