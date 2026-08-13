/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const childMocks = vi.hoisted(() => ({
  election: vi.fn(),
  vote: vi.fn(),
}));

vi.mock('../AgendaElectionSection', () => ({
  AgendaElectionSection: (props: any) => {
    childMocks.election(props);
    return <div data-testid="election-workspace">{props.roleName}</div>;
  },
  isAutoAssignedRoleElection: (election: any) => Boolean(election.auto_assigned),
}));

vi.mock('../AgendaVoteSection', () => ({
  AgendaVoteSection: (props: any) => {
    childMocks.vote(props);
    return <div data-testid="vote-workspace">{props.voteTitle}</div>;
  },
}));

import { EventLiveFocusDialog, eventLiveFocusDialogTestApi } from '../EventLiveFocusDialog';

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
  it('normalizes helper fallbacks and every visual status', () => {
    const api = eventLiveFocusDialogTestApi;
    expect(api.getInitials()).toBe('U');
    expect(api.getInitials('  ')).toBe('U');
    expect(api.getInitials('Ada Byron Lovelace')).toBe('AB');
    expect(
      api.getSpeakerName({ user: { name: 'Name', email: 'mail' }, title: 'Title' }, 'Fallback')
    ).toBe('Name');
    expect(api.getSpeakerName({ user: { email: 'mail' }, title: 'Title' }, 'Fallback')).toBe(
      'mail'
    );
    expect(api.getSpeakerName({ title: 'Title' }, 'Fallback')).toBe('Title');
    expect(api.getSpeakerName({}, 'Fallback')).toBe('Fallback');
    expect(['male', 'female', 'diverse', 'not specified']).toEqual(
      ['male', 'female', 'diverse', null].map(gender => api.formatGenderBadgeLabel(t, gender))
    );
    expect(api.canShowVotingAction('closed')).toBe(false);
    expect(api.canShowVotingAction()).toBe(true);
    expect(api.getAgendaVisualStatus('completed', true)).toBe('active');
    for (const status of ['completed', 'in-progress', 'pending', 'planned'] as const) {
      expect(api.getAgendaVisualStatus(status, false)).toBe(status);
    }
    expect(api.getAgendaVisualStatus('unknown', false)).toBe('planned');
    expect(api.ignoreCandidateAction()).toBeUndefined();
  });

  it('renders the no-active-item state and hides closed voting actions', () => {
    render(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={null}
        currentAgendaItemTopNumber={undefined}
        streamRuntimeStatus="unknown"
        votingPhase="closed"
        hasUserVoted
        onVoteClick={undefined}
      />
    );

    expect(screen.getAllByText('features.events.stream.noActiveItem').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Vote' })).toBeNull();
    expect(screen.queryByText('features.events.agenda.voteSubmitted')).toBeNull();
  });

  it('renders rich speaker metadata, ordering, timing, and gender fallbacks', () => {
    const { rerender } = render(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={{
          ...baseProps.currentAgendaItem,
          duration: 12,
          description: 'Detailed agenda item',
        }}
        currentAgendaItemTopNumber={undefined}
        streamIsLive={false}
        eventStartTimestamp={Date.now() + 100_000}
        showSpeakerGender
        userId="user-next"
        canManageAgenda={false}
        onMarkSpeakerCompleted={vi.fn()}
        speakerList={[
          {
            id: 'later',
            order: 3,
            time: 5,
            user: { id: 'user-next', email: 'next@example.test', gender: 'female' },
          },
          {
            id: 'current',
            order: undefined,
            user: { id: 'other', name: 'Current Person', gender: 'male' },
          },
          {
            id: 'third',
            order: 4,
            title: 'Third Person',
            user: { id: 'third-user', gender: 'diverse' },
          },
          { id: 'fourth', order: 5, user: { id: 'fourth-user', gender: null } },
          { id: 'done', order: 1, completed: true, user: { name: 'Finished' } },
        ]}
      />
    );

    expect(document.body.textContent).toContain('Detailed agenda item');
    expect(document.body.textContent).toContain('next@example.test');
    expect(document.body.textContent).toContain('Third Person');
    expect(document.body.textContent).not.toContain('Finished');
    expect(document.body.textContent).toContain('features.events.agenda.youSpeakerPosition');
    expect(document.body.textContent).toContain('features.events.stream.startsIn');

    rerender(
      <EventLiveFocusDialog
        {...baseProps}
        showSpeakerGender={false}
        speakerList={[
          { id: 'first', order: 1, user: { name: 'First' } },
          { id: 'second', order: 2, user: { name: 'Second' } },
        ]}
      />
    );
    expect(document.body.textContent).toContain('Second');
  });

  it('renders election and vote workspaces with source and fallback values', () => {
    const election = {
      id: 'election-1',
      title: null,
      election_mode: null,
      seat_count: undefined,
      candidates: undefined,
      offline_tallies: undefined,
      status: 'open',
      delegate_assignment_meta: { targetEventId: 'meta-event' },
    };
    const { rerender } = render(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={{ ...baseProps.currentAgendaItem, type: 'election' }}
        streamElection={election}
        streamDelegateTargetEvent={{ id: 'direct-event', title: 'Direct event' }}
      />
    );
    expect(document.body.textContent).toContain('features.events.agenda.role');

    rerender(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={{ ...baseProps.currentAgendaItem, type: 'election' }}
        streamElection={{
          ...election,
          election_mode: 'single',
          title: 'Chair',
          seat_count: 1,
          candidates: [],
          offline_tallies: [],
        }}
      />
    );
    expect(document.body.textContent).toContain('Chair');

    for (const vote of [
      { id: 'vote-1', title: 'Explicit vote', choices: [], offline_tallies: [] },
      { id: 'vote-2', title: '', choices: undefined, offline_tallies: undefined },
    ]) {
      rerender(
        <EventLiveFocusDialog
          {...baseProps}
          currentAgendaItem={{
            ...baseProps.currentAgendaItem,
            type: 'vote',
            title: vote.id === 'vote-2' ? '' : 'Agenda vote',
          }}
          streamElection={undefined}
          streamVote={vote}
        />
      );
    }
    expect(document.body.textContent).toContain('features.events.agenda.vote');
  });

  it('renders submitted, disabled, candidate, and offline-tally fallback states', () => {
    const onBecomeCandidate = vi.fn();
    const { rerender } = render(
      <EventLiveFocusDialog {...baseProps} onVoteClick={undefined} hasUserVoted />
    );
    expect(screen.getByText('features.events.agenda.voteSubmitted')).toBeTruthy();

    rerender(
      <EventLiveFocusDialog
        {...baseProps}
        canVote
        disableVoteButton
        hasUserVoted={false}
        onVoteClick={vi.fn()}
        onJoinSpeakerList={vi.fn()}
        userId="joined-user"
      />
    );
    expect(document.body.textContent).toContain('Offline votes are entered via tallies.');

    rerender(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={{ ...baseProps.currentAgendaItem, type: 'election' }}
        canBeCandidate={false}
        onBecomeCandidate={onBecomeCandidate}
        canManageAgenda
        showOfflineTallyButton
        onOfflineTallyClick={undefined}
        offlineTallyMode="edit"
        offlineTallyLabel={null}
      />
    );
    const candidate = document.querySelector(
      '[data-action-id="agendas.live-focus.candidacy.become"]'
    )!;
    fireEvent.click(candidate);
    expect(onBecomeCandidate).not.toHaveBeenCalled();
    expect(
      document
        .querySelector('[data-action-id="agendas.live-focus.offline-tally.open"]')
        ?.hasAttribute('disabled')
    ).toBe(true);
  });
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
    const onVoteClick = vi.fn();
    render(
      <EventLiveFocusDialog
        {...baseProps}
        isVotingActionAvailable={false}
        onVoteClick={onVoteClick}
      />
    );

    const voteButton = screen.getByRole('button', { name: 'Vote' });

    expect(voteButton).toBeTruthy();
    expect(voteButton.className).toContain('civic-ballot-submit');
    expect(voteButton.getAttribute('data-action-id')).toBe('agendas.live-focus.ballot.cast');
    fireEvent.click(voteButton);
    expect(onVoteClick).toHaveBeenCalledTimes(1);
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
    expect(
      screen.getByRole('button', { name: 'Offline tally' }).getAttribute('data-action-id')
    ).toBe('agendas.live-focus.offline-tally.open');
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
    expect(
      screen.getByRole('button', { name: 'Next voting step' }).getAttribute('data-action-id')
    ).toBe('agendas.live-focus.vote-step.next');
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('data-action-id')).toBe(
      'agendas.live-focus.item.edit'
    );
  });

  it('controls the dialog and speaker rail through stable actions', () => {
    const onOpenChange = vi.fn();
    const onMarkSpeakerCompleted = vi.fn();

    render(
      <EventLiveFocusDialog
        {...baseProps}
        onOpenChange={onOpenChange}
        canManageAgenda
        userId="speaker-user"
        speakerList={[
          {
            id: 'speaker-1',
            order: 1,
            completed: false,
            user: { id: 'speaker-user', name: 'Ada Speaker' },
          },
        ]}
        onMarkSpeakerCompleted={onMarkSpeakerCompleted}
      />
    );

    const completeSpeakerButtons = screen.getAllByRole('button', { name: 'Done' });
    expect(completeSpeakerButtons[0].getAttribute('data-action-id')).toBe(
      'agendas.live-focus.speaker.complete'
    );
    fireEvent.click(completeSpeakerButtons[0]);
    expect(onMarkSpeakerCompleted).toHaveBeenCalledWith('speaker-1');

    const collapseButton = screen.getByRole('button', { name: 'Hide speaker list' });
    expect(collapseButton.getAttribute('data-action-id')).toBe(
      'agendas.live-focus.speakers.collapse'
    );
    fireEvent.click(collapseButton);

    const expandButtons = screen.getAllByRole('button', { name: 'Show speaker list' });
    expect(
      expandButtons.every(
        button => button.dataset.actionId === 'agendas.live-focus.speakers.expand'
      )
    ).toBe(true);
    fireEvent.click(expandButtons[0]);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton.getAttribute('data-action-id')).toBe('agendas.live-focus.dialog.close');
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('dispatches speaker and candidacy actions across controlled fullscreen states', () => {
    const onJoinSpeakerList = vi.fn();
    const onLeaveSpeakerList = vi.fn();
    const onBecomeCandidate = vi.fn();
    const onWithdrawCandidacy = vi.fn();
    const electionItem = { ...baseProps.currentAgendaItem, type: 'election' };
    const { rerender } = render(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={electionItem}
        userId="user-1"
        canBeCandidate
        onJoinSpeakerList={onJoinSpeakerList}
        onBecomeCandidate={onBecomeCandidate}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="agendas.live-focus.speaker.join"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.live-focus.candidacy.become"]')!
    );
    expect(onJoinSpeakerList).toHaveBeenCalledTimes(1);
    expect(onBecomeCandidate).toHaveBeenCalledTimes(1);

    rerender(
      <EventLiveFocusDialog
        {...baseProps}
        currentAgendaItem={electionItem}
        userId="user-1"
        isUserInSpeakerList
        isUserCandidate
        canBeCandidate
        onLeaveSpeakerList={onLeaveSpeakerList}
        onWithdrawCandidacy={onWithdrawCandidacy}
      />
    );

    fireEvent.click(document.querySelector('[data-action-id="agendas.live-focus.speaker.leave"]')!);
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.live-focus.candidacy.withdraw"]')!
    );
    expect(onLeaveSpeakerList).toHaveBeenCalledTimes(1);
    expect(onWithdrawCandidacy).toHaveBeenCalledTimes(1);
  });

  it('dispatches voting and lifecycle management actions in fullscreen', () => {
    const callbacks = {
      onStartFinalVote: vi.fn(),
      onCloseFinalVote: vi.fn(),
      onCompleteItem: vi.fn(),
      onNextItem: vi.fn(),
    };

    render(<EventLiveFocusDialog {...baseProps} canManageAgenda {...callbacks} />);

    for (const [actionId, callback] of [
      ['agendas.live-focus.vote.start-final', callbacks.onStartFinalVote],
      ['agendas.live-focus.vote.close-final', callbacks.onCloseFinalVote],
      ['agendas.live-focus.item.complete', callbacks.onCompleteItem],
      ['agendas.live-focus.item.next', callbacks.onNextItem],
    ] as const) {
      fireEvent.click(document.querySelector(`[data-action-id="${actionId}"]`)!);
      expect(callback).toHaveBeenCalledTimes(1);
    }
  });
});
