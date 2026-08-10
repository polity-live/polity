import { describe, expect, it } from 'vitest';

import {
  buildCommentTree,
  sortComments,
  sortCommentTree,
  type CommentWithReplies,
} from '../comment-tree';

const comment = (
  id: string,
  created_at: number,
  options: Partial<CommentWithReplies> = {}
): CommentWithReplies => ({ id, created_at, upvotes: 0, downvotes: 0, ...options }) as never;

describe('comment-tree', () => {
  it('builds nested replies, keeps roots and drops orphaned children', () => {
    const input = [
      comment('root', 1),
      comment('child', 2, { parent_id: 'root' }),
      comment('grandchild', 3, { parent_id: 'child' }),
      comment('second-root', 4),
      comment('orphan', 5, { parent_id: 'missing' }),
    ];

    const tree = buildCommentTree(input);

    expect(tree.map(node => node.id)).toEqual(['root', 'second-root']);
    expect(tree[0]?.replies?.[0]?.id).toBe('child');
    expect(tree[0]?.replies?.[0]?.replies?.[0]?.id).toBe('grandchild');
    expect(input.every(node => node.replies === undefined)).toBe(true);
  });

  it('sorts by score, then creation time, without mutating the source', () => {
    const input = [
      comment('low', 3, { upvotes: 1, downvotes: 2 }),
      comment('older-high', 1, { upvotes: 3, downvotes: undefined }),
      comment('newer-high', 2, { upvotes: 3, downvotes: 0 }),
    ];

    expect(sortComments(input, 'votes').map(node => node.id)).toEqual([
      'newer-high',
      'older-high',
      'low',
    ]);
    expect(input.map(node => node.id)).toEqual(['low', 'older-high', 'newer-high']);
  });

  it('sorts by newest creation time', () => {
    expect(
      sortComments([comment('old', 1), comment('new', 2)], 'time').map(node => node.id)
    ).toEqual(['new', 'old']);
  });

  it('recursively sorts reply trees and preserves leaf identity', () => {
    const leaf = comment('leaf', 1);
    expect(sortCommentTree(leaf, 'votes')).toBe(leaf);
    const empty = comment('empty', 1, { replies: [] });
    expect(sortCommentTree(empty, 'time')).toBe(empty);

    const root = comment('root', 0, {
      replies: [
        comment('low', 2, {
          upvotes: 0,
          replies: [comment('nested-old', 1), comment('nested-new', 2)],
        }),
        comment('high', 1, { upvotes: 2 }),
      ],
    });
    const sorted = sortCommentTree(root, 'votes');
    expect(sorted.replies?.map(node => node.id)).toEqual(['high', 'low']);
    expect(sorted.replies?.[1]?.replies?.map(node => node.id)).toEqual([
      'nested-new',
      'nested-old',
    ]);
  });
});
