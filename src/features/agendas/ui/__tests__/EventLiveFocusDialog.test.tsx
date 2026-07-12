/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('shows the livestream for a live agenda item even when the event status is not started', () => {
    render(
      <EventLiveFocusDialog
        {...baseProps}
        streamUrl="https://www.youtube.com/watch?v=xIbdyxtLPx4"
        streamIsLive
      />
    );

    expect(screen.getByTitle('features.events.stream.liveStream')).toBeTruthy();
  });

  it('hides the livestream when the agenda item is no longer live', () => {
    render(
      <EventLiveFocusDialog
        {...baseProps}
        streamUrl="https://www.youtube.com/watch?v=xIbdyxtLPx4"
        streamIsLive={false}
      />
    );

    expect(screen.queryByTitle('features.events.stream.liveStream')).toBeNull();
  });

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

  it('keeps voting management, offline tally, and candidacy actions available in fullscreen', () => {
    const onStartVote = vi.fn();
    const onOfflineTallyClick = vi.fn();
    const onBecomeCandidate = vi.fn();

    render(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={{ ...baseProps.currentAgendaItem, type: 'election' }}
        canManageAgenda
        canBeCandidate
        isUserCandidate={false}
        isVotingActionAvailable
        onVoteClick={() => undefined}
        onStartVote={onStartVote}
        showOfflineTallyButton
        onOfflineTallyClick={onOfflineTallyClick}
        offlineTallyMode="create"
        offlineTallyLabel="Offline tally"
        onBecomeCandidate={onBecomeCandidate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Offline tally' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'features.events.agenda.actions.becomeCandidate',
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'features.events.agenda.actions.startVote' })
    );

    expect(onOfflineTallyClick).toHaveBeenCalledTimes(1);
    expect(onBecomeCandidate).toHaveBeenCalledTimes(1);
    expect(onStartVote).toHaveBeenCalledTimes(1);
  });

  it('renders the shared voting workspace and sequence management actions in fullscreen', () => {
    const onJumpToNextVoteStep = vi.fn();
    const onEditItem = vi.fn();

    render(
      <EventLiveFocusDialog
        {...baseProps}
        canManageAgenda
        votingWorkspace={<div data-testid="shared-voting-workspace">CR voting sequence</div>}
        onJumpToNextVoteStep={onJumpToNextVoteStep}
        onEditItem={onEditItem}
      />
    );

    expect(screen.getByTestId('shared-voting-workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next voting step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onJumpToNextVoteStep).toHaveBeenCalledTimes(1);
    expect(onEditItem).toHaveBeenCalledTimes(1);
  });
});
