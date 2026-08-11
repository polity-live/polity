/* @vitest-environment jsdom */

import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventAgendaViewProps } from '../EventAgendaView';
import { EventAgendaView } from '../EventAgendaView';

const mocks = vi.hoisted(() => ({
  actionBar: vi.fn(),
  liveFocus: vi.fn(),
  offlineTally: vi.fn(),
  voteCast: vi.fn(),
  namedResults: vi.fn(),
  activeHeader: vi.fn(),
  contextCard: vi.fn(),
  speakerList: vi.fn(),
  election: vi.fn(),
  vote: vi.fn(),
  virtualList: vi.fn(),
  editDialog: vi.fn(),
  card: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, ...props }: any) => {
    const query = search ? new URLSearchParams(search).toString() : '';
    return (
      <a href={query ? `${to}?${query}` : to} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('../AgendaActionBar', () => ({
  AgendaActionBar: (props: any) => {
    mocks.actionBar(props);
    return null;
  },
}));
vi.mock('../EventLiveFocusDialog', () => ({
  EventLiveFocusDialog: (props: any) => {
    mocks.liveFocus(props);
    return null;
  },
}));
vi.mock('../OfflineTallyDialog', () => ({
  OfflineTallyDialog: (props: any) => {
    mocks.offlineTally(props);
    return null;
  },
}));
vi.mock('@/features/elections/ui/CandidacyPasswordDialog', () => ({
  CandidacyPasswordDialog: () => null,
}));
vi.mock('@/features/vote-cast/ui/VoteCastDialog', () => ({
  VoteCastDialog: (props: any) => {
    mocks.voteCast(props);
    return null;
  },
}));
vi.mock('../NamedBallotResultsDialog', () => ({
  NamedBallotResultsDialog: (props: any) => {
    mocks.namedResults(props);
    return null;
  },
}));
vi.mock('../AgendaActiveItemHeader', () => ({
  AgendaActiveItemHeader: (props: any) => {
    mocks.activeHeader(props);
    return <div>{props.action}</div>;
  },
}));
vi.mock('../AgendaUiSystem', () => ({
  AgendaPageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  AgendaSurface: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  AgendaSectionHeading: ({ title }: { title: ReactNode }) => <h2>{title}</h2>,
  AgendaContextTabs: ({ details, speakers }: any) => (
    <div>
      {details}
      {speakers}
    </div>
  ),
  AgendaVotingWorkspace: ({ changeRequests, election, vote, children }: any) => (
    <div>
      {children}
      {changeRequests}
      {election}
      {vote}
    </div>
  ),
}));
vi.mock('../AgendaItemContextCard', () => ({
  AgendaItemContextCard: (props: any) => {
    mocks.contextCard(props);
    return <div data-testid="agenda-context-card" />;
  },
}));
vi.mock('../AgendaSpeakerListSection', () => ({
  AgendaSpeakerListSection: (props: any) => {
    mocks.speakerList(props);
    return <div data-testid="agenda-speaker-list" />;
  },
}));
vi.mock('../AgendaElectionSection', () => ({
  AgendaElectionSection: (props: any) => {
    mocks.election(props);
    return <div data-testid="agenda-election" />;
  },
  isAutoAssignedRoleElection: (election: any) => Boolean(election.auto_assigned),
}));
vi.mock('../AgendaVoteSection', () => ({
  AgendaVoteSection: (props: any) => {
    mocks.vote(props);
    return <div data-testid="agenda-vote" />;
  },
}));
vi.mock('../VirtualAgendaChangeRequestCardsList', () => ({
  VirtualAgendaChangeRequestCardsList: (props: any) => {
    mocks.virtualList(props);
    return <div data-testid="agenda-cr-list" />;
  },
}));
vi.mock('../EditElectionVoteDialog', () => ({
  EditElectionVoteDialog: (props: any) => {
    mocks.editDialog(props);
    return null;
  },
}));
vi.mock('@/zero/shared', async importOriginal => ({
  ...(await importOriginal<typeof import('@/zero/shared')>()),
  isNamedBallot: (visibility: unknown) => visibility === 'named',
}));
vi.mock('@/features/agendas/ui/AgendaCard.tsx', () => ({
  AgendaCard: (props: any) => {
    mocks.card(props);
    return (
      <article>
        {props.title}
        {props.footerRight}
        {props.dragHandle}
      </article>
    );
  },
}));
vi.mock('@/features/agendas/ui/TimelineItem.tsx', () => ({
  TimelineItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../AgendaRelatedEntityCard', () => ({
  AgendaRelatedRoleCard: () => <div data-testid="related-role" />,
}));
vi.mock('@/features/search/ui/EventSearchCard', () => ({
  EventSearchCard: () => <div data-testid="event-search-card" />,
}));
vi.mock('@/features/events/ui/EventLivestreamPlayer', () => ({
  EventLivestreamPlayer: () => <div data-testid="livestream" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const t = (key: string, params?: string | Record<string, unknown>) =>
  typeof params === 'string' ? params : key;

function makeProps(overrides: Record<string, unknown> = {}) {
  const actionBarHook = {
    hasVotingRight: true,
    hasCandidateRight: true,
    isUserInSpeakerList: false,
    isUserCandidate: false,
    canJoinSpeakerList: false,
    speakerLoading: false,
    candidateLoading: false,
    disableSecretIndicativeVoteButton: false,
    secretIndicativeVoteTooltip: null,
    handleVoteClick: vi.fn(),
    handleJoinSpeakerList: vi.fn(),
    handleLeaveSpeakerList: vi.fn(),
    handleBecomeCandidate: vi.fn(),
    handleWithdrawCandidacy: vi.fn(),
    handleStartVote: vi.fn(),
    handleEditClick: vi.fn(),
    voteDialogOpen: false,
    setVoteDialogOpen: vi.fn(),
    editDialogOpen: false,
    setEditDialogOpen: vi.fn(),
    candidacyDialogProps: {},
    voteCasting: {
      phase: 'indicative',
      isLoading: false,
      castAmendmentVote: vi.fn(),
      castElectionVote: vi.fn(),
    },
  };
  const props = {
    eventId: 'event-1',
    t,
    language: 'en',
    user: { id: 'user-1' },
    navigate: vi.fn(),
    event: { id: 'event-1', title: 'Assembly', stream_url: null },
    eventLoading: false,
    agendaItems: [],
    isLoading: false,
    agendaNav: {
      hasPreviousItem: false,
      hasNextItem: false,
      hasStartableItem: false,
      canMoveToNextItem: false,
      isCurrentItemCompleted: false,
      isLoading: false,
      startFirstPendingItem: vi.fn(),
      moveToPreviousItem: vi.fn(),
      moveToNextItem: vi.fn(),
      completeCurrentItem: vi.fn(),
    },
    activeItemRef: { current: null },
    searchQuery: '',
    setSearchQuery: vi.fn(),
    typeFilter: 'all',
    setTypeFilter: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    showFilters: false,
    setShowFilters: vi.fn(),
    statsOpen: false,
    setStatsOpen: vi.fn(),
    streamOpen: false,
    setStreamOpen: vi.fn(),
    streamContextPane: 'details',
    setStreamContextPane: vi.fn(),
    liveFocusOpen: false,
    setLiveFocusOpen: vi.fn(),
    streamAgendaItem: null,
    streamRuntimeStatus: 'planned',
    streamIsLive: false,
    streamSpeakerListData: [],
    isUserInSpeakerList: false,
    streamElection: null,
    streamVote: null,
    streamDelegateTargetEvent: null,
    streamVoteSequenceItems: [],
    streamAmendmentDiscussions: [],
    selectedCRChoices: [],
    isCRToolbarActive: false,
    selectedCRPhase: 'pending',
    selectedCRDialogPhase: 'indicative',
    hasUserVotedOnSelectedCR: false,
    selectedCRTitle: '',
    effectiveToolbarVotingPhase: 'pending',
    toolbarAgendaItem: null,
    toolbarElection: null,
    activeCRToolbarItem: null,
    topNumberByAgendaItemId: new Map<string, number>(),
    toolbarAgendaItemTopNumber: null,
    streamAgendaItemTopNumber: null,
    actionBarHook,
    indicativeSelections: [],
    finalSelections: [],
    indicativeDecisions: [],
    finalDecisions: [],
    userHasElectionVoted: false,
    userSelectedCandidateIds: [],
    userHasVoteVoted: false,
    userSelectedChoiceIds: [],
    offlineTallyDialogOpen: false,
    offlineTallyPasswordError: null,
    offlineTallySubmitError: null,
    isOfflineTallySubmitting: false,
    passwordError: null,
    setPasswordError: vi.fn(),
    isPasswordVerifying: false,
    setIsPasswordVerifying: vi.fn(),
    verifyVotingPassword: vi.fn(),
    canManageAgenda: true,
    canManageVotes: true,
    canJoinSpeakerList: false,
    confirmedOfflineParticipantCount: 0,
    showOfflineTallyButton: false,
    sequenceVotingLoading: false,
    filteredAgendaItems: [],
    confirmedAgendaItems: [],
    scheduledButUnconfirmedAgendaItems: [],
    draggedAgendaItemId: null,
    dragOverAgendaItemId: null,
    setDragOverAgendaItemId: vi.fn(),
    dragInsertPosition: null,
    setDragInsertPosition: vi.fn(),
    isAgendaItemDraggable: vi.fn(() => false),
    handleAgendaDragStart: vi.fn(),
    handleAgendaDrop: vi.fn(),
    handleAgendaDragEnd: vi.fn(),
    formatTime: vi.fn(() => ''),
    handleToolbarStartVote: vi.fn(),
    handleToolbarStartFinalVote: vi.fn(),
    handleToolbarCloseVote: vi.fn(),
    handleCastCRVoteFromDialog: vi.fn(),
    handleOfflineTallyDialogOpenChange: vi.fn(),
    handleOpenOfflineTallyDialog: vi.fn(),
    handleSubmitOfflineTally: vi.fn(),
    handleAddToSpeakerList: vi.fn(),
    handleMarkSpeakerCompleted: vi.fn(),
    handleRemoveFromSpeakerList: vi.fn(),
    setNamedResultsTarget: vi.fn(),
    ...overrides,
  };

  return props as unknown as EventAgendaViewProps;
}

describe('EventAgendaView actions', () => {
  it('navigates from missing and empty states through stable links', () => {
    const { rerender } = render(<EventAgendaView {...makeProps({ event: null })} />);
    expect(screen.getByRole('link').getAttribute('data-action-id')).toBe(
      'agendas.event-agenda.calendar.back'
    );

    rerender(<EventAgendaView {...makeProps()} />);
    const createLink = screen.getByRole('link', {
      name: 'features.events.agenda.createFirstItem',
    });
    expect(createLink.getAttribute('data-action-id')).toBe(
      'agendas.event-agenda.item.create-first'
    );
  });

  it('dispatches live, statistics, stream, and filter controls through stable actions', () => {
    const setLiveFocusOpen = vi.fn();
    const setStatsOpen = vi.fn();
    const setStreamOpen = vi.fn();
    const setShowFilters = vi.fn();
    render(
      <EventAgendaView
        {...makeProps({ setLiveFocusOpen, setStatsOpen, setStreamOpen, setShowFilters })}
      />
    );

    for (const [actionId, callback] of [
      ['agendas.event-agenda.live-focus.open', setLiveFocusOpen],
      ['agendas.event-agenda.stream.toggle', setStreamOpen],
      ['agendas.event-agenda.statistics.toggle', setStatsOpen],
      ['agendas.event-agenda.filters.toggle', setShowFilters],
    ] as const) {
      fireEvent.click(document.querySelector(`[data-action-id="${actionId}"]`)!);
      expect(callback).toHaveBeenCalled();
    }
  });

  it('selects type and status filters with explicit option identities', () => {
    const setTypeFilter = vi.fn();
    const setStatusFilter = vi.fn();
    render(
      <EventAgendaView {...makeProps({ showFilters: true, setTypeFilter, setStatusFilter })} />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="agendas.event-agenda.filters.type.open"]')!
    );
    for (const value of ['all', 'election', 'vote', 'speech', 'discussion']) {
      expect(
        document.querySelector(`[data-action-id="agendas.event-agenda.filters.type.${value}"]`)
      ).toBeTruthy();
    }
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.event-agenda.filters.type.election"]')!
    );
    expect(setTypeFilter).toHaveBeenCalledWith('election');

    fireEvent.click(
      document.querySelector('[data-action-id="agendas.event-agenda.filters.status.open"]')!
    );
    for (const value of ['all', 'pending', 'in-progress', 'completed', 'planned']) {
      expect(
        document.querySelector(`[data-action-id="agendas.event-agenda.filters.status.${value}"]`)
      ).toBeTruthy();
    }
    fireEvent.click(
      document.querySelector('[data-action-id="agendas.event-agenda.filters.status.completed"]')!
    );
    expect(setStatusFilter).toHaveBeenCalledWith('completed');
  });

  it('forwards drag start and end through the stable agenda item handle', () => {
    const item = {
      id: 'item-1',
      title: 'Budget',
      type: 'discussion',
      status: 'planned',
      duration: 30,
      order_index: 0,
    };
    const handleAgendaDragStart = vi.fn();
    const handleAgendaDragEnd = vi.fn();
    render(
      <EventAgendaView
        {...makeProps({
          agendaItems: [item],
          filteredAgendaItems: [item],
          confirmedAgendaItems: [item],
          isAgendaItemDraggable: vi.fn(() => true),
          handleAgendaDragStart,
          handleAgendaDragEnd,
          topNumberByAgendaItemId: new Map([['item-1', 1]]),
        })}
      />
    );

    const dragHandle = document.querySelector('[data-action-id="agendas.event-agenda.item.drag"]')!;
    fireEvent.dragStart(dragHandle);
    fireEvent.dragEnd(dragHandle);
    expect(handleAgendaDragStart).toHaveBeenCalled();
    expect(handleAgendaDragEnd).toHaveBeenCalled();
  });

  it('renders the tutorial change-request and election workspaces with sequence actions', () => {
    const setSelectedCRToolbarItemId = vi.fn();
    const setNamedResultsTarget = vi.fn();
    const handleVoteClick = vi.fn();
    const streamAgendaItem = {
      id: 'stream-item',
      title: 'Wahl zum Kreisvorsitzenden',
      description: 'German description',
      type: 'election',
      status: 'in-progress',
      amendment_id: 'amendment-1',
      amendment: { id: 'amendment-1', reason: 'Reason', group: { id: 'group-1' } },
      duration: 30,
      activated_at: Date.now() - 1_000,
      end_time: Date.now() + 100_000,
    };
    const streamElection = {
      id: 'election-1',
      title: 'Kreisvorsitzende:r',
      description: 'German election',
      election_mode: 'single',
      seat_count: 1,
      candidates: [],
      offline_tallies: [],
      status: 'open',
      ballot_visibility: 'named',
      closing_end_time: Date.now() + 50_000,
      role: { id: 'role-1' },
    };
    const crVoting = {
      progress: 50,
      completedItems: [{ id: 'done' }],
      allCRsProcessed: false,
      isTimelineComplete: false,
      hasUserVoted: false,
      getUserSelectedChoiceIds: vi.fn(),
      castCRVote: vi.fn(),
      startIndicativePhase: vi.fn(),
      closeVoting: vi.fn(),
    };
    const activeCRToolbarItem = { id: 'cr-one', vote: { id: 'cr-vote' } };
    render(
      <EventAgendaView
        {...makeProps({
          event: {
            id: 'event-1',
            title: 'Tutorial',
            tutorial_run_id: 'tutorial-run',
            stream_url: 'https://stream.test',
            gender_quota_enabled: true,
            change_request_vote_order: 'cr_number',
          },
          streamOpen: true,
          streamIsLive: true,
          streamAgendaItem,
          streamAgendaItemTopNumber: 3,
          streamRuntimeStatus: 'in-progress',
          streamElection,
          streamVote: { id: 'vote-hidden-by-cr', title: 'Hidden vote', choices: [] },
          streamDelegateTargetEvent: { id: 'target', title: 'Target' },
          streamVoteSequenceItems: [activeCRToolbarItem],
          streamAgendaItemAmendmentEditingMode: undefined,
          streamAmendmentDiscussions: undefined,
          crVoting,
          toolbarAgendaItem: streamAgendaItem,
          toolbarAgendaItemTopNumber: 3,
          toolbarElection: streamElection,
          liveAgendaItemId: 'stream-item',
          spotlightAgendaItemId: 'stream-item',
          activeCRToolbarItem,
          selectedCRChoices: [{ id: 'yes', label: 'Yes' }],
          selectedCRPhase: 'pending',
          isCRToolbarActive: true,
          canStartSelectedCRFinalVote: true,
          nextStartableSequenceItem: { id: 'next' },
          attendanceMode: 'offline',
          setSelectedCRToolbarItemId,
          setNamedResultsTarget,
          actionBarHook: {
            ...makeProps().actionBarHook,
            handleVoteClick,
            canJoinSpeakerList: true,
          },
        })}
      />
    );

    expect(mocks.virtualList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        editingMode: 'event_final_closing_vote',
        canVote: false,
        currentItemId: 'cr-one',
        amendmentId: 'amendment-1',
      })
    );
    const virtualListProps = mocks.virtualList.mock.calls.at(-1)?.[0];
    if (!virtualListProps) throw new Error('Expected virtual list props');
    (virtualListProps.onOpenVoteDialog as (id: string) => void)('cr-two');
    expect(setSelectedCRToolbarItemId).toHaveBeenCalledWith('cr-two');
    expect(handleVoteClick).toHaveBeenCalledTimes(1);
    expect(mocks.election.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ roleName: 'District Chair', delegateTargetEventId: 'target' })
    );
    const electionProps = mocks.election.mock.calls.at(-1)?.[0];
    if (!electionProps) throw new Error('Expected election props');
    (electionProps.onBecomeCandidate as () => void)();
    (electionProps.onOpenNamedResults as () => void)();
    expect(setNamedResultsTarget).toHaveBeenCalledWith('election');
    expect(screen.getAllByTestId('related-role').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('event-search-card').length).toBeGreaterThan(0);
    expect(screen.getByTestId('livestream')).toBeTruthy();
  });

  it('maps normal election and vote dialog fallbacks and named-result callbacks', async () => {
    const setNamedResultsTarget = vi.fn();
    const setPasswordError = vi.fn();
    const setIsPasswordVerifying = vi.fn();
    const verifyVotingPassword = vi
      .fn()
      .mockRejectedValueOnce(new Error('bad password'))
      .mockRejectedValueOnce('denied');
    const streamAgendaItem = {
      id: 'stream-vote',
      title: '',
      description: null,
      type: 'vote',
      status: 'in-progress',
      amendment_id: null,
      duration: null,
      start_time: Date.now() - 5_000,
      completed_at: null,
    };
    const streamElection = {
      id: 'election-2',
      title: null,
      election_mode: null,
      seat_count: undefined,
      max_votes: undefined,
      offline_tallies: undefined,
      ballot_visibility: 'named',
      status: 'open',
      candidates: [
        {
          id: 'full',
          user: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@test', avatar: 'avatar' },
        },
        { id: 'email', user: { first_name: '', last_name: '', email: 'email@test' } },
        { id: 'fallback-user', user: { first_name: '', last_name: '', email: '' } },
        { id: 'named', name: 'Named candidate' },
        { id: 'fallback-candidate' },
      ],
    };
    const streamVote = {
      id: 'vote-2',
      title: '',
      status: 'open',
      majority_type: 'relative',
      ballot_visibility: 'named',
      offline_tallies: undefined,
      choices: [
        { id: 'yes', label: 'Yes', semantic_key: 'accept', order_index: 1 },
        { id: 'fallback', label: '', semantic_key: undefined, order_index: 2 },
      ],
    };
    render(
      <EventAgendaView
        {...makeProps({
          user: null,
          streamOpen: true,
          streamAgendaItem,
          streamElection,
          streamVote,
          streamDelegateTargetEvent: null,
          toolbarAgendaItem: streamAgendaItem,
          liveAgendaItemId: 'stream-vote',
          effectiveToolbarVotingPhase: 'indication',
          namedResultsTarget: 'vote',
          setNamedResultsTarget,
          namedResultsDialogConfig: null,
          toolbarOfflineTallyEntity: null,
          toolbarOfflineTallyPhase: null,
          verifyVotingPassword,
          setPasswordError,
          setIsPasswordVerifying,
        })}
      />
    );

    expect(mocks.election.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        roleName: 'features.events.agenda.role',
        electionMode: null,
        seatCount: null,
        offlineTallies: [],
        delegateTargetEventTitle: null,
      })
    );
    expect(mocks.vote.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ voteTitle: 'Vote', offlineTallies: [] })
    );
    const electionProps = mocks.election.mock.calls.at(-1)?.[0];
    const voteProps = mocks.vote.mock.calls.at(-1)?.[0];
    if (!electionProps || !voteProps) throw new Error('Expected voting section props');
    (electionProps.onOpenNamedResults as () => void)();
    (voteProps.onOpenNamedResults as () => void)();
    expect(setNamedResultsTarget).toHaveBeenCalledWith('election');
    expect(setNamedResultsTarget).toHaveBeenCalledWith('vote');

    const dialog = mocks.voteCast.mock.calls.at(-1)?.[0];
    expect(dialog.candidates.map((candidate: any) => candidate.name)).toEqual([
      'Ada Lovelace',
      'email@test',
      'Candidate',
      'Named candidate',
      'Candidate',
    ]);
    expect(dialog.choices).toEqual([
      { id: 'yes', label: 'Yes', semanticKey: 'accept' },
      { id: 'fallback', label: 'Choice', semanticKey: null },
    ]);
    await expect(dialog.onPasswordSubmit('bad')).rejects.toThrow('bad password');
    await expect(dialog.onPasswordSubmit('bad-again')).rejects.toBe('denied');
    expect(setPasswordError).toHaveBeenCalledWith('bad password');
    expect(setPasswordError).toHaveBeenCalledWith('Verification failed');
    expect(setIsPasswordVerifying).toHaveBeenLastCalledWith(false);

    const named = mocks.namedResults.mock.calls.at(-1)?.[0];
    named.onOpenChange(true);
    named.onOpenChange(false);
    expect(setNamedResultsTarget).toHaveBeenCalledWith(null);
    expect(mocks.offlineTally.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        phase: 'indicative',
        choices: [],
        tallies: [],
        maxTotalVotes: null,
        maxPerEntryVotes: null,
      })
    );
  });

  it('exposes every managed CR and regular voting toolbar phase', () => {
    const props = makeProps();
    const toolbarAgendaItem = {
      id: 'toolbar-item',
      title: 'Toolbar item',
      type: 'vote',
      status: 'in-progress',
      activated_at: Date.now() - 1_000,
    };
    const activeCRToolbarItem = { id: 'cr-active', vote: { id: 'cr-vote' } };
    const common = {
      ...props,
      toolbarAgendaItem,
      liveAgendaItemId: 'toolbar-item',
      activeCRToolbarItem,
      selectedCRChoices: [{ id: 'yes', label: 'Yes' }],
      isCRToolbarActive: true,
      selectedCRPhase: 'pending',
      canStartSelectedCRFinalVote: true,
      nextStartableSequenceItem: { id: 'next' },
      effectiveClosingVoteItem: { id: 'closing', status: 'pending' },
      attendanceMode: 'hybrid',
    } as EventAgendaViewProps;
    const { rerender } = render(<EventAgendaView {...common} />);
    expect(mocks.actionBar.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onStartVote: props.handleToolbarStartVote,
        onCompleteItem: undefined,
        onJumpToNextVoteStep: props.handleJumpToNextStartableSequenceItem,
      })
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onStartVote: props.handleToolbarStartVote,
        isVotingActionAvailable: true,
        hasUserVoted: false,
      })
    );
    const actionBarProps = mocks.actionBar.mock.calls.at(-1)?.[0];
    if (!actionBarProps) throw new Error('Expected action bar props');
    (actionBarProps.onOpenCurrentItem as () => void)();
    expect(props.navigate).toHaveBeenCalled();

    rerender(<EventAgendaView {...common} selectedCRPhase="indication" />);
    expect(mocks.actionBar.mock.calls.at(-1)?.[0].onStartFinalVote).toBe(
      props.handleToolbarStartFinalVote
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0].onStartFinalVote).toBe(
      props.handleToolbarStartFinalVote
    );

    rerender(
      <EventAgendaView
        {...common}
        selectedCRPhase="final"
        effectiveClosingVoteItem={{ id: 'closing', status: 'completed' }}
      />
    );
    expect(mocks.actionBar.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onCloseFinalVote: props.handleToolbarCloseVote,
        onCompleteItem: props.agendaNav.completeCurrentItem,
      })
    );

    rerender(
      <EventAgendaView
        {...common}
        selectedCRPhase="closed"
        hasUserVotedOnSelectedCR
        activeCRToolbarItem={{ id: 'placeholder', _votePlaceholder: true, vote: null }}
        selectedCRChoices={[]}
      />
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ onVoteClick: undefined, isVotingActionAvailable: false })
    );

    for (const phase of ['pending', 'indication', 'final'] as const) {
      rerender(
        <EventAgendaView
          {...common}
          isCRToolbarActive={false}
          effectiveToolbarVotingPhase={phase}
          streamElection={phase === 'pending' ? { id: 'election', candidates: [] } : null}
          streamVote={phase !== 'pending' ? { id: 'vote', choices: [] } : null}
          userHasElectionVoted={phase === 'pending'}
          userHasVoteVoted={phase !== 'pending'}
        />
      );
    }
    expect(mocks.actionBar.mock.calls.at(-1)?.[0].onCloseFinalVote).toBe(
      props.handleToolbarCloseVote
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onCloseFinalVote: props.handleToolbarCloseVote,
        hasUserVoted: true,
      })
    );
  });

  it('renders timing, creator, tutorial, statistics, and drag/drop list variants', () => {
    const now = Date.now();
    const completed = {
      id: 'completed',
      title: 'Completed',
      description: null,
      type: 'discussion',
      status: 'completed',
      completed_at: now - 1_000,
      order_index: null,
      duration: 0,
      creator: { first_name: 'Ada', last_name: 'Lovelace', email: 'fallback@test' },
    };
    const ongoing = {
      id: 'ongoing',
      title: 'Ongoing',
      description: 'Ongoing description',
      type: 'amendment',
      status: 'in-progress',
      activated_at: now - 1_000,
      calculated_end_time: now + 100_000,
      duration: 10,
      amendment_id: 'amendment-1',
      amendment: { id: 'amendment-1' },
      creator: { first_name: '', last_name: '', email: 'creator@test' },
    };
    const future = {
      id: 'future',
      title: 'Wahl zum Kreisvorsitzenden',
      description: 'German description',
      type: 'election',
      status: 'planned',
      calculated_start_time: now + 200_000,
      calculated_end_time: now + 300_000,
      duration: null,
      election: [{ election_mode: 'single', seat_count: undefined, role: undefined }],
    };
    const plain = {
      id: 'plain',
      title: undefined,
      description: undefined,
      type: 'speech',
      status: 'pending',
      duration: undefined,
      election: [],
    };
    const items = [completed, ongoing, future, plain];
    const setDragOverAgendaItemId = vi.fn();
    const setDragInsertPosition = vi.fn();
    const handleAgendaDrop = vi.fn();
    const setSearchQuery = vi.fn();
    const { rerender } = render(
      <EventAgendaView
        {...makeProps({
          event: { id: 'event-1', title: 'Tutorial', tutorial_run_id: 'tutorial-run' },
          agendaItems: items,
          filteredAgendaItems: items,
          confirmedAgendaItems: [completed, ongoing],
          scheduledButUnconfirmedAgendaItems: [future, plain],
          liveAgendaItemId: 'ongoing',
          spotlightAgendaItemId: 'ongoing',
          draggedAgendaItemId: 'future',
          dragOverAgendaItemId: 'ongoing',
          dragInsertPosition: 'above',
          setDragOverAgendaItemId,
          setDragInsertPosition,
          handleAgendaDrop,
          setSearchQuery,
          isAgendaItemDraggable: vi.fn(status => status !== 'completed'),
          topNumberByAgendaItemId: new Map([['completed', 8]]),
          statsOpen: true,
          streamOpen: true,
        })}
      />
    );

    expect(document.body.textContent).toContain('Election of the District Chair');
    expect(mocks.card.mock.calls.find(call => call[0].id === 'completed')?.[0].creatorName).toBe(
      'Ada Lovelace'
    );
    expect(mocks.card.mock.calls.find(call => call[0].id === 'ongoing')?.[0].creatorName).toBe(
      'creator@test'
    );
    expect(document.body.textContent).toContain('features.events.agenda.election');
    expect(document.body.textContent).toContain('features.events.agenda.amendment');

    const ongoingReveal = document.querySelector('[data-agenda-item-id="ongoing"]')!;
    const ongoingWrapper = ongoingReveal.closest('.relative.rounded-lg') as HTMLDivElement;
    vi.spyOn(ongoingWrapper, 'getBoundingClientRect')
      .mockReturnValueOnce({
        top: 100,
        height: 100,
        bottom: 200,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      })
      .mockReturnValue({
        top: -100,
        height: 100,
        bottom: 0,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: -100,
        toJSON: () => ({}),
      });
    const dragOver = createEvent.dragOver(ongoingWrapper);
    Object.defineProperty(dragOver, 'clientY', { value: 10 });
    fireEvent(ongoingWrapper, dragOver);
    const dragEnter = createEvent.dragEnter(ongoingWrapper);
    Object.defineProperty(dragEnter, 'clientY', { value: 90 });
    fireEvent(ongoingWrapper, dragEnter);
    fireEvent.dragLeave(ongoingWrapper);
    fireEvent.drop(ongoingWrapper);
    expect(setDragInsertPosition).toHaveBeenCalledWith('above');
    expect(setDragInsertPosition).toHaveBeenCalledWith('below');
    expect(handleAgendaDrop).toHaveBeenCalledWith('ongoing', 'above');

    const completedWrapper = document
      .querySelector('[data-agenda-item-id="completed"]')!
      .closest('.relative.rounded-lg') as HTMLDivElement;
    fireEvent.dragOver(completedWrapper);
    fireEvent.dragEnter(completedWrapper);
    fireEvent.drop(completedWrapper);

    const dragHandle = document.querySelector('[data-action-id="agendas.event-agenda.item.drag"]')!;
    fireEvent.mouseDown(dragHandle);
    fireEvent.click(dragHandle);
    fireEvent.change(screen.getByPlaceholderText('features.events.agenda.searchPlaceholder'), {
      target: { value: 'budget' },
    });
    expect(setSearchQuery).toHaveBeenCalledWith('budget');

    const futureWithFallbackElection = {
      ...future,
      election: [{ election_mode: null, seat_count: null, role: null }],
    };
    rerender(
      <EventAgendaView
        {...makeProps({
          language: 'de',
          event: { id: 'event-1', title: 'Tutorial', tutorial_run_id: 'tutorial-run' },
          agendaItems: items,
          filteredAgendaItems: items,
          confirmedAgendaItems: [],
          scheduledButUnconfirmedAgendaItems: [
            completed,
            ongoing,
            futureWithFallbackElection,
            plain,
          ],
          liveAgendaItemId: 'ongoing',
          spotlightAgendaItemId: 'future',
          draggedAgendaItemId: 'ongoing',
          dragOverAgendaItemId: 'future',
          dragInsertPosition: 'below',
          setDragOverAgendaItemId,
          setDragInsertPosition,
          handleAgendaDrop,
          isAgendaItemDraggable: vi.fn(status => status !== 'completed'),
        })}
      />
    );
    const futureWrapper = document
      .querySelector('[data-agenda-item-id="future"]')!
      .closest('.relative.rounded-lg') as HTMLDivElement;
    const futureRect = vi.spyOn(futureWrapper, 'getBoundingClientRect');
    futureRect.mockReturnValue({
      top: -100,
      height: 100,
      bottom: 0,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: -100,
      toJSON: () => ({}),
    });
    const belowDragOver = createEvent.dragOver(futureWrapper);
    Object.defineProperty(belowDragOver, 'clientY', { value: 10 });
    fireEvent(futureWrapper, belowDragOver);
    futureRect.mockReturnValue({
      top: 100,
      height: 100,
      bottom: 200,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    const aboveDragEnter = createEvent.dragEnter(futureWrapper);
    Object.defineProperty(aboveDragEnter, 'clientY', { value: 10 });
    fireEvent(futureWrapper, aboveDragEnter);
    const completedFallbackWrapper = document
      .querySelector('[data-agenda-item-id="completed"]')!
      .closest('.relative.rounded-lg') as HTMLDivElement;
    fireEvent.dragLeave(completedFallbackWrapper);

    rerender(
      <EventAgendaView
        {...makeProps({
          agendaItems: [ongoing],
          filteredAgendaItems: [ongoing],
          confirmedAgendaItems: [ongoing],
          scheduledButUnconfirmedAgendaItems: [],
          dragInsertPosition: null,
          isAgendaItemDraggable: vi.fn(() => true),
          handleAgendaDrop,
        })}
      />
    );
    const fallbackDropWrapper = document
      .querySelector('[data-agenda-item-id="ongoing"]')!
      .closest('.relative.rounded-lg') as HTMLDivElement;
    fireEvent.drop(fallbackDropWrapper);
    expect(handleAgendaDrop).toHaveBeenCalledWith('ongoing', 'below');
  });

  it('renders both loading gates', () => {
    const props = makeProps();
    const { rerender } = render(<EventAgendaView {...props} isLoading />);
    expect(document.querySelector('.animate-pulse')).not.toBeNull();
    rerender(<EventAgendaView {...props} eventLoading />);
    expect(document.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('covers empty stream, permission, tally, and next-item fallback chains', () => {
    const props = makeProps();
    const streamAgendaItem = {
      id: 'fallback-stream',
      title: undefined,
      description: undefined,
      type: null,
      status: 'in-progress',
      amendment_id: 'amendment-fallback',
      amendment: null,
      duration: undefined,
      activated_at: null,
      start_time: null,
      completed_at: null,
      end_time: null,
    };
    const common = {
      ...props,
      event: { id: 'event-1', title: 'Assembly', change_request_vote_order: undefined },
      agendaItems: null,
      streamOpen: true,
      streamAgendaItem,
      streamRuntimeStatus: null,
      streamVoteSequenceItems: [{ id: 'cr-fallback', vote: { id: 'vote-fallback' } }],
      toolbarAgendaItem: streamAgendaItem,
      liveAgendaItemId: 'fallback-stream',
      activeCRToolbarItem: null,
      selectedCRChoices: [],
      selectedCRPhase: 'pending',
      isCRToolbarActive: true,
      attendanceMode: 'hybrid',
      canManageVoteSequence: false,
      canManageVotes: false,
      canManageAgenda: false,
      canJoinSpeakerList: true,
      showOfflineTallyButton: true,
      toolbarOfflineTallyEntity: {
        kind: 'election',
        title: null,
        choices: undefined,
        tallies: undefined,
        maxTotalVotes: undefined,
        maxPerEntryVotes: undefined,
        participantCount: undefined,
        votesPerParticipant: undefined,
      },
      actionBarHook: {
        ...props.actionBarHook,
        hasVotingRight: false,
        canJoinSpeakerList: true,
      },
      agendaNav: {
        ...props.agendaNav,
        hasNextItem: true,
        canMoveToNextItem: false,
      },
    } as EventAgendaViewProps;
    const { rerender } = render(<EventAgendaView {...common} />);
    expect(mocks.virtualList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        canManage: false,
        canVote: false,
        voteDisabledTooltip: undefined,
        currentItemId: null,
        agendaTitle: null,
        defaultSortMode: null,
        onCastVote: undefined,
        onStartIndicative: undefined,
        onStartFinal: undefined,
        onCloseVoting: undefined,
      })
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onVoteClick: undefined,
        onMarkSpeakerCompleted: undefined,
        onEditItem: undefined,
        nextItemDisabled: true,
      })
    );
    expect(mocks.offlineTally.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        maxPerEntryLimitLabel: 'Candidate',
        choices: [],
        tallies: [],
      })
    );
    expect(mocks.activeHeader.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ status: 'planned', type: 'discussion' })
    );
    expect(mocks.contextCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ election: undefined })
    );
    expect(mocks.speakerList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        agendaStartTime: undefined,
        onAddToSpeakerList: props.handleAddToSpeakerList,
        onMarkCompleted: undefined,
      })
    );
    expect(mocks.editDialog.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        agendaItemTitle: null,
        election: undefined,
        vote: undefined,
        choices: [],
      })
    );

    rerender(
      <EventAgendaView
        {...common}
        canManageVotes
        agendaNav={{
          ...props.agendaNav,
          hasNextItem: true,
          canMoveToNextItem: true,
          isLoading: true,
        }}
      />
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0].nextItemDisabled).toBe(true);

    rerender(
      <EventAgendaView
        {...common}
        canManageAgenda
        canManageVotes={false}
        toolbarAgendaItem={null}
        agendaNav={{
          ...props.agendaNav,
          hasNextItem: true,
          canMoveToNextItem: true,
          isLoading: false,
        }}
      />
    );
    expect(mocks.liveFocus.mock.calls.at(-1)?.[0].nextItemDisabled).toBe(true);

    rerender(
      <EventAgendaView
        {...common}
        canManageVoteSequence={undefined}
        canManageVotes={false}
        canManageAgenda
      />
    );
    expect(mocks.actionBar).toHaveBeenCalled();
  });

  it('uses the tutorial named-results title for an election stream', () => {
    render(
      <EventAgendaView
        {...makeProps({
          event: { id: 'event-1', title: 'Tutorial', tutorial_run_id: 'tutorial-run' },
          streamAgendaItem: { id: 'tutorial-election', type: 'election', title: 'German' },
          streamElection: { id: 'election', title: 'German role', candidates: [] },
          namedResultsTarget: 'election',
        })}
      />
    );
    expect(mocks.namedResults.mock.calls.at(-1)?.[0].title).toBe('District Chair');
  });
});
