/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('sorts and displays aggregate counters independently of private vote rows', () => {
    const aggregateComments: CommentData[] = [
      {
        ...comments[0],
        text: 'Lower aggregate score',
        upvotes: 2,
        downvotes: 1,
        votes: [{ id: 'own-vote', vote: 1, user: { id: 'u1' } }],
      },
      {
        ...comments[1],
        text: 'Higher aggregate score',
        upvotes: 12,
        downvotes: 3,
        votes: [],
      },
    ];
    const { container } = render(
      <CommentThread
        comments={aggregateComments}
        currentUserId="u1"
        onAddComment={async () => undefined}
        onVote={async () => undefined}
      />
    );

    const renderedText = container.textContent ?? '';

    expect(renderedText.indexOf('Higher aggregate score')).toBeLessThan(
      renderedText.indexOf('Lower aggregate score')
    );
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('opens the root composer before the comment list', () => {
    render(
      <CommentThread
        comments={comments}
        currentUserId="u1"
        onAddComment={async () => undefined}
        onVote={async () => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Comment' }));

    const composer = screen.getByPlaceholderText('Add a comment...');
    const list = document.querySelector('[data-slot="discussion-comment-list"]');

    expect(composer).toBeTruthy();
    expect(
      composer.compareDocumentPosition(list as Node) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders vote actions in order and collapses the complete reply subtree', () => {
    const onVote = vi.fn(async () => undefined);
    const threadedComment: CommentData = {
      ...comments[0],
      text: 'Visible parent body',
      replies: [
        {
          id: 'reply',
          text: 'Visible reply body',
          createdAt: 3,
          parent_id: 'older',
          creator: { id: 'u2', name: 'Grace' },
          votes: [],
          replies: [],
        },
      ],
    };

    render(
      <CommentThread
        comments={[threadedComment]}
        currentUserId="u1"
        onAddComment={async () => undefined}
        onVote={onVote}
      />
    );

    const actionBar = document.querySelector('[data-slot="discussion-action-bar"]');
    const actions = actionBar?.querySelectorAll('button, [data-slot="vote-score"]');

    expect(actions?.[0].getAttribute('aria-label')).toBe('Upvote');
    expect(actions?.[1].getAttribute('data-slot')).toBe('vote-score');
    expect(actions?.[2].getAttribute('aria-label')).toBe('Downvote');
    expect(actions?.[3].textContent).toContain('Reply');

    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[0]);

    expect(screen.queryByText('Visible parent body')).toBeNull();
    expect(screen.queryByText('Visible reply body')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe(
      'false'
    );
  });

  it('locks both vote actions until the optimistic client apply completes', async () => {
    let completeVote: (() => void) | undefined;
    const onVote = vi.fn(
      () =>
        new Promise<void>(resolve => {
          completeVote = resolve;
        })
    );

    render(
      <CommentThread
        comments={[comments[0]]}
        currentUserId="u1"
        onAddComment={async () => undefined}
        onVote={onVote}
      />
    );

    const upvote = screen.getByRole('button', { name: 'Upvote' });
    const downvote = screen.getByRole('button', { name: 'Downvote' });
    fireEvent.click(upvote);
    fireEvent.click(downvote);

    expect(onVote).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Upvote' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Downvote' }).hasAttribute('disabled')).toBe(true);

    await act(async () => completeVote?.());
  });
});
