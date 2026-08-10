/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscussionActionBar, DiscussionCollapseToggle } from '../DiscussionActions';

const mocks = vi.hoisted(() => ({
  voteProps: [] as any[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('@/features/shared/ui/voting', () => ({
  VoteButtons: (props: any) => {
    mocks.voteProps.push(props);
    return <div data-testid="vote-buttons" />;
  },
}));

beforeEach(() => {
  mocks.voteProps.length = 0;
});

afterEach(() => cleanup());

describe('DiscussionActionBar', () => {
  it('derives an upvote and handles voting and vote removal', () => {
    const onUpvote = vi.fn();
    render(
      <DiscussionActionBar score={4} hasUpvoted onUpvote={onUpvote}>
        <span>Actions</span>
      </DiscussionActionBar>
    );

    expect(mocks.voteProps.at(-1)).toMatchObject({ score: 4, userVote: 1 });
    mocks.voteProps.at(-1).onVote(1);
    mocks.voteProps.at(-1).onVote(0);
    expect(onUpvote).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('derives a downvote and handles voting and vote removal', () => {
    const onDownvote = vi.fn();
    render(<DiscussionActionBar score={-2} hasDownvoted onDownvote={onDownvote} />);

    expect(mocks.voteProps.at(-1)).toMatchObject({ score: -2, userVote: -1 });
    mocks.voteProps.at(-1).onVote(-1);
    mocks.voteProps.at(-1).onVote(0);
    expect(onDownvote).toHaveBeenCalledTimes(2);
  });

  it('supports neutral votes, a score-only view, and no score', () => {
    const neutral = render(<DiscussionActionBar showVoting score={undefined} />);
    expect(mocks.voteProps.at(-1)).toMatchObject({ score: 0, userVote: 0 });
    mocks.voteProps.at(-1).onVote(0);
    mocks.voteProps.at(-1).onVote(1);
    mocks.voteProps.at(-1).onVote(-1);
    neutral.unmount();

    const scoreOnly = render(<DiscussionActionBar score={7} showVoting={false} />);
    expect(screen.getByText('7').getAttribute('data-slot')).toBe('discussion-score');
    scoreOnly.unmount();

    render(<DiscussionActionBar />);
    expect(screen.queryByTestId('vote-buttons')).toBeNull();
    expect(document.querySelector('[data-slot="discussion-score"]')).toBeNull();
  });
});

describe('DiscussionCollapseToggle', () => {
  it.each([
    [true, 'translated:common.actions.expand', 'false'],
    [false, 'translated:common.actions.collapse', 'true'],
  ] as const)('renders collapsed=%s and forwards toggles', (collapsed, label, expanded) => {
    const onToggle = vi.fn();
    render(
      <DiscussionCollapseToggle collapsed={collapsed} onToggle={onToggle} className="custom" />
    );
    const button = screen.getByRole('button', { name: label });
    expect(button.getAttribute('aria-expanded')).toBe(expanded);
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
