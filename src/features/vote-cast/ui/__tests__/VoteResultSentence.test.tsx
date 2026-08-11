/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoteResultSentence } from '../VoteResultSentence';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

afterEach(cleanup);

describe('VoteResultSentence', () => {
  it('renders stable deep links for the elected role and final winner', () => {
    const { container } = render(
      <VoteResultSentence
        type="election"
        result="passed"
        winnerName="Ada"
        winnerLink="/user/ada"
        roleName="Chair"
        roleLink="/role/chair"
        voteSharePercent={67}
        isFinal
      />
    );
    expect(screen.getByText('Ada').getAttribute('href')).toBe('/user/ada');
    expect(screen.getByText('Chair').getAttribute('href')).toBe('/role/chair');
    expect(container.querySelector('[data-action-id="vote-cast.result.winner.open"]')).toBeTruthy();
    expect(container.querySelector('[data-action-id="vote-cast.result.role.open"]')).toBeTruthy();
  });

  it('renders a final elected role as text when it has no route', () => {
    render(
      <VoteResultSentence
        type="election"
        result="passed"
        winnerName="Ada"
        winnerLink="/user/ada"
        roleName="Chair"
        voteSharePercent={67}
        isFinal
      />
    );
    expect(screen.getByText('Chair').closest('a')).toBeNull();
    expect(document.querySelector('[data-action-id="vote-cast.result.role.open"]')).toBeNull();
  });

  it('renders a final winner without role, route, or share', () => {
    const { rerender } = render(
      <VoteResultSentence type="election" result="passed" winnerName="Ada" isFinal />
    );
    expect(screen.getByText('Ada').closest('a')).toBeNull();
    expect(screen.getByText(/features.events.voting.wonElection/)).toBeTruthy();
    rerender(
      <VoteResultSentence
        type="election"
        result="passed"
        winnerName="Ada"
        voteSharePercent={70}
        isFinal
      />
    );
    expect(document.body.textContent).toContain('70%');
  });

  it('renders a role without link and omits an undefined vote share', () => {
    render(
      <VoteResultSentence
        type="election"
        result="passed"
        winnerName="Ada"
        roleName="Chair"
        isFinal
      />
    );
    expect(screen.getByText('Chair').closest('a')).toBeNull();
    expect(document.body.textContent).not.toContain('%');
  });

  it('renders passed, rejected, and tied non-final sentences with custom classes', () => {
    const { container, rerender } = render(
      <VoteResultSentence type="vote" result="passed" voteSharePercent={60} className="custom" />
    );
    expect(container.firstElementChild?.className).toContain('custom');
    rerender(<VoteResultSentence type="vote" result="rejected" voteSharePercent={40} />);
    expect(container.textContent).toBeTruthy();
    rerender(<VoteResultSentence type="vote" result="tie" />);
    expect(container.textContent).toBeTruthy();
    rerender(
      <VoteResultSentence type="election" result="passed" winnerName="Ada" isFinal={false} />
    );
    expect(screen.getByText('features.votes.resultSentence.winner')).toBeTruthy();
  });
});
