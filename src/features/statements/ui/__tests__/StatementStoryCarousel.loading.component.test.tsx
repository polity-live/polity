/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatementStoryCarousel } from '../StatementStoryCarousel';

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [
    [
      {
        id: 'statement-1',
        title: 'Story title',
        text: 'Story body',
        is_story: true,
        created_at: Date.now(),
        user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
        group: { name: 'Civic Group' },
      },
    ],
  ],
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    statements: {
      carousel: () => ({}),
    },
  },
}));

vi.mock('@/features/statements/hooks/useStatementDetail', () => ({
  useStatementDetail: () => ({
    isLoading: true,
    statement: null,
    canAccess: false,
  }),
}));

vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {} }),
}));

vi.mock('@/features/shared/ui/UserIdentityLink', () => ({
  UserIdentityLink: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));

vi.mock('@/features/shared/ui/voting/VoteButtons', () => ({
  VoteButtons: () => <div data-testid="vote-buttons" />,
}));

afterEach(() => {
  cleanup();
});

describe('StatementStoryCarousel loading state', () => {
  it('renders a shaped detail skeleton while the selected story detail loads', () => {
    render(<StatementStoryCarousel />);

    fireEvent.click(screen.getByRole('button', { name: /Story title/i }));

    expect(document.querySelector('[data-slot="statement-story-detail-skeleton"]')).toBeTruthy();
  });
});
