/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => (key.includes('1150') ? 'Upvote' : 'Downvote'),
}));

import { VoteButtons } from '../VoteButtons';

afterEach(cleanup);

function scoreClass() {
  return screen.getByText(/^-?\d+$/).className;
}

describe('VoteButtons branch contracts', () => {
  it('derives a positive plain score and toggles an existing upvote', () => {
    const onVote = vi.fn();
    const { container } = render(
      <VoteButtons upvotes={5} downvotes={2} userVote={1} onVote={onVote} />
    );
    expect(screen.getByText('3')).toBeTruthy();
    expect(scoreClass()).toContain('--badge-success-fg');
    expect(container.querySelector('[data-slot="vote-buttons"]')?.className).toContain('flex-col');
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    expect(onVote.mock.calls).toEqual([[0], [-1]]);
  });

  it('derives a negative horizontal score and toggles an existing downvote', () => {
    const onVote = vi.fn();
    render(
      <VoteButtons
        downvotes={4}
        userVote={-1}
        onVote={onVote}
        orientation="horizontal"
        size="sm"
        className="votes"
      />
    );
    expect(screen.getByText('-4')).toBeTruthy();
    expect(scoreClass()).toContain('--badge-danger-fg');
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Downvote' }));
    expect(onVote.mock.calls).toEqual([[1], [0]]);
    expect(screen.getByRole('button', { name: 'Downvote' }).className).toContain('h-7');
  });

  it('uses zero defaults, large sizing, and no score tone', () => {
    const { container } = render(<VoteButtons userVote={0} onVote={vi.fn()} size="lg" />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(scoreClass()).not.toContain('--badge-success-fg');
    expect(scoreClass()).not.toContain('--badge-danger-fg');
    expect(screen.getByRole('button', { name: 'Upvote' }).className).toContain('h-10');
    expect(container.querySelector('[data-presentation="plain"]')).toBeTruthy();
  });

  it('uses a missing downvote as zero', () => {
    render(<VoteButtons upvotes={6} userVote={0} onVote={vi.fn()} />);
    expect(screen.getByText('6')).toBeTruthy();
  });

  it.each([
    [1, '--badge-accent-fg'],
    [-1, '--badge-info-fg'],
    [0, 'text-xs'],
  ] as const)('renders surface state %s', (userVote, expectedClass) => {
    render(<VoteButtons score={2} userVote={userVote} onVote={vi.fn()} presentation="surface" />);
    expect(scoreClass()).toContain(expectedClass);
    expect(screen.getByRole('button', { name: 'Upvote' }).className).toContain('p-0');
  });

  it('forwards the pending state and explicit supplied score', () => {
    render(
      <VoteButtons score={-8} upvotes={100} downvotes={0} userVote={0} onVote={vi.fn()} isPending />
    );
    expect(screen.getByText('-8')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Upvote' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
