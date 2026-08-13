/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoteButtons } from '../VoteButtons';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    key === 'generated.inline.1150_upvote_c52661f1' ? 'Upvote' : 'Downvote',
}));

afterEach(cleanup);

describe('VoteButtons', () => {
  it('renders the reusable surface presentation and preserves vote toggling', () => {
    const onVote = vi.fn();
    const { container, rerender } = render(
      <VoteButtons
        score={4}
        userVote={1}
        onVote={onVote}
        orientation="horizontal"
        presentation="surface"
      />
    );

    const group = container.querySelector('[data-slot="vote-buttons"]');
    expect(group?.getAttribute('data-presentation')).toBe('surface');
    expect(group?.className).toContain('bg-[var(--surface-muted)]');
    expect(screen.getByText('4').getAttribute('data-slot')).toBe('vote-score');
    expect(screen.getByRole('button', { name: 'Upvote' }).getAttribute('aria-pressed')).toBe(
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    expect(onVote).toHaveBeenNthCalledWith(1, 0);
    expect(onVote).toHaveBeenNthCalledWith(2, -1);

    rerender(
      <VoteButtons
        score={4}
        userVote={0}
        onVote={onVote}
        orientation="horizontal"
        presentation="surface"
        isPending
      />
    );
    expect((screen.getByRole('button', { name: 'Upvote' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: 'Downvote' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
