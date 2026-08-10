/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoteButtons, VoteButtonsView } from '../VoteButtons';

const mocks = vi.hoisted(() => ({ eventVoting: {} as any }));

vi.mock('../../hooks/useEventVoting', () => ({
  useEventVoting: () => mocks.eventVoting,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/voting', () => ({
  SelectedVoteBadge: ({ vote }: any) => <div data-testid="selected">{vote}</div>,
  VotingUnavailableMessage: ({ children }: any) => <div data-testid="unavailable">{children}</div>,
  VoteChoiceButtons: ({ onVote, size, isLoading }: any) => (
    <button
      data-testid="choices"
      data-size={size}
      data-loading={String(isLoading)}
      onClick={() => onVote('accept')}
    >
      choices
    </button>
  ),
}));

const labels = { accept: 'Yes', reject: 'No', abstain: 'Abstain' };

afterEach(cleanup);

describe('VoteButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventVoting = {
      canVote: true,
      hasUserVoted: false,
      userVote: null,
      currentSession: { phase: 'voting' },
      isLoading: false,
      castVote: vi.fn(),
    };
  });

  it('renders selected, unavailable, and actionable view states', () => {
    const onVote = vi.fn();
    const common = {
      isLoading: false,
      onVote,
      labels,
      selectedVoteLabels: { ...labels, prefix: 'Your vote' },
      noVotingRightsLabel: 'No rights',
    };
    const { rerender } = render(
      <VoteButtonsView {...common} canVote hasUserVoted userVote="accept" />
    );
    expect(screen.getByTestId('selected').textContent).toBe('accept');

    rerender(<VoteButtonsView {...common} canVote={false} hasUserVoted userVote={null} />);
    expect(screen.getByTestId('unavailable').textContent).toBe('No rights');

    rerender(
      <VoteButtonsView
        {...common}
        canVote
        hasUserVoted={false}
        userVote={null}
        isLoading
        size="lg"
      />
    );
    fireEvent.click(screen.getByTestId('choices'));
    expect(screen.getByTestId('choices').dataset.size).toBe('lg');
    expect(onVote).toHaveBeenCalledWith('accept');

    rerender(<VoteButtonsView {...common} canVote hasUserVoted={false} userVote={null} />);
    expect(screen.getByTestId('choices').dataset.size).toBe('default');
  });

  it('renders only an active voting session and binds its session id', () => {
    const { container, rerender } = render(
      <VoteButtons eventId="event-1" agendaItemId="agenda-1" sessionId="session-1" />
    );
    fireEvent.click(screen.getByTestId('choices'));
    expect(mocks.eventVoting.castVote).toHaveBeenCalledWith('session-1', 'accept');

    mocks.eventVoting = { ...mocks.eventVoting, currentSession: { phase: 'introduction' } };
    rerender(<VoteButtons eventId="event-1" agendaItemId="agenda-1" sessionId="session-1" />);
    expect(container.innerHTML).toBe('');

    mocks.eventVoting = { ...mocks.eventVoting, currentSession: null };
    rerender(
      <VoteButtons eventId="event-1" agendaItemId="agenda-1" sessionId="session-1" size="sm" />
    );
    expect(container.innerHTML).toBe('');
  });
});
