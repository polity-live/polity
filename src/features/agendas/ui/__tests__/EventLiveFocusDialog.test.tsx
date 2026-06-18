/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventLiveFocusDialog } from '../EventLiveFocusDialog';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string, fallback?: string | Record<string, unknown>) => {
  if (typeof fallback === 'string') return fallback;
  return key;
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  t,
  currentAgendaItem: {
    id: 'agenda-item-1',
    type: 'amendment',
    status: 'active',
    voting_phase: 'pending',
    title: 'Amendment: A36',
  },
  currentAgendaItemTopNumber: 1,
  streamRuntimeStatus: 'active',
  streamIsLive: true,
  isEventStarted: true,
  speakerList: [],
  isUserInSpeakerList: false,
  canManageAgenda: false,
  votingPhase: 'pending',
  canVote: true,
  hasUserVoted: true,
  indicativeSelections: [],
  finalSelections: [],
  userHasElectionVoted: false,
  userSelectedCandidateIds: [],
  indicativeDecisions: [],
  finalDecisions: [],
  userHasVoteVoted: false,
  userSelectedChoiceIds: [],
};

describe('EventLiveFocusDialog', () => {
  it('renders the Vote button for amendment items when the toolbar can vote', () => {
    render(
      <EventLiveFocusDialog
        {...baseProps}
        isVotingActionAvailable={false}
        onVoteClick={() => undefined}
      />
    );

    const voteButton = screen.getByRole('button', { name: 'Vote' });

    expect(voteButton).toBeTruthy();
    expect(voteButton.className).toContain('civic-ballot-submit');
    expect(screen.queryByText('Stimme abgegeben')).toBeNull();
  });

  it('renders the Vote button as blocked with help when active voting rights are missing', () => {
    render(
      <EventLiveFocusDialog
        {...baseProps}
        canVote={false}
        hasUserVoted={false}
        isVotingActionAvailable={false}
        onVoteClick={() => undefined}
      />
    );

    const voteButton = screen.getByRole('button', { name: 'Vote' });

    expect(voteButton.getAttribute('aria-disabled')).toBe('true');
    expect(voteButton.className).toContain('text-muted-foreground');
    expect(
      screen.getByText('Active Voting Rights are required to vote in this event.')
    ).toBeTruthy();
  });
});
