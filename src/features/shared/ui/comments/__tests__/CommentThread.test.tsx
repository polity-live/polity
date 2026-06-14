/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CommentThread } from '../CommentThread';
import type { CommentData } from '../CommentItem';

const comments: CommentData[] = [
  {
    id: 'older',
    text: 'Older but popular',
    createdAt: 1,
    parent_id: null,
    creator: { id: 'u1', name: 'Ada' },
    votes: [{ id: 'v1', vote: 1 }],
    replies: [],
  },
  {
    id: 'newer',
    text: 'Newer comment',
    createdAt: 2,
    parent_id: null,
    creator: { id: 'u2', name: 'Grace' },
    votes: [],
    replies: [],
  },
];

afterEach(() => {
  cleanup();
});

describe('CommentThread', () => {
  it('uses a custom empty state', () => {
    render(
      <CommentThread
        comments={[]}
        onAddComment={async () => undefined}
        onVote={async () => undefined}
        emptyState={<p>No discussion yet</p>}
      />
    );

    expect(screen.getByText('No discussion yet')).toBeTruthy();
  });

  it('respects controlled time sorting', () => {
    const { container } = render(
      <CommentThread
        comments={comments}
        sortBy="time"
        onAddComment={async () => undefined}
        onVote={async () => undefined}
      />
    );

    const renderedText = container.textContent ?? '';

    expect(renderedText.indexOf('Newer comment')).toBeLessThan(
      renderedText.indexOf('Older but popular')
    );
  });
});
