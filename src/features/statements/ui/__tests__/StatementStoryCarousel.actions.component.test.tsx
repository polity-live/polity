/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatementStoryCarousel } from '../StatementStoryCarousel';

const statements = [
  {
    id: 'statement-1',
    title: 'First story',
    text: 'First body',
    is_story: true,
    user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
    group: { name: 'Civic Group' },
  },
  {
    id: 'statement-2',
    title: 'Second story',
    text: 'Second body',
    is_story: true,
    user: { id: 'user-2', first_name: 'Grace', last_name: 'Hopper' },
    group: { name: 'Digital Group' },
  },
];

vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [statements] }));
vi.mock('@/zero/queries', () => ({
  queries: { statements: { carousel: () => ({}) } },
}));
vi.mock('@/features/statements/hooks/useStatementDetail', () => ({
  useStatementDetail: ({ id }: any) => ({
    isLoading: false,
    canAccess: true,
    statement: statements.find(statement => statement.id === id),
    computedCommentCount: 0,
    computedDownvotes: 0,
    computedUpvotes: 0,
    currentVoteValue: 0,
    comments: [],
    userId: 'viewer-1',
    handleVote: vi.fn(),
    handleAddComment: vi.fn(),
    handleCommentVote: vi.fn(),
  }),
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {} }),
}));
vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({ 'data-action-id': actionId, name }: any) => (
    <a href="/user" data-action-id={actionId}>
      {name}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => null }));
vi.mock('@/features/shared/ui/voting/VoteButtons', () => ({ VoteButtons: () => null }));
vi.mock('@/features/statements/ui/StatementMediaDisplay', () => ({
  StatementMediaDisplay: () => null,
}));
vi.mock('@/features/statements/ui/StatementTextRenderer', () => ({
  StatementTextRenderer: ({ text }: any) => <span>{text}</span>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

afterEach(cleanup);

describe('StatementStoryCarousel action contracts', () => {
  it('opens a story and navigates the viewer with stable accessible intents', () => {
    render(<StatementStoryCarousel />);

    const firstStory = screen.getByRole('button', { name: /First story/ });
    expect(firstStory.dataset.actionId).toBe('statements.carousel.story.open');
    fireEvent.click(firstStory);

    const author = document.querySelector('[data-action-id="statements.carousel.author.open"]');
    expect(author?.textContent).toContain('Ada Lovelace');
    const previous = screen.getByRole('button', { name: 'Previous statement' });
    const next = screen.getByRole('button', { name: 'Next statement' });
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(next);
    expect(screen.getByText('Second body')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Previous statement' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('closes the story viewer through its stable intent', () => {
    render(<StatementStoryCarousel />);
    fireEvent.click(screen.getByRole('button', { name: /First story/ }));

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.dataset.actionId).toBe('statements.carousel.viewer.close');
    fireEvent.click(close);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});
