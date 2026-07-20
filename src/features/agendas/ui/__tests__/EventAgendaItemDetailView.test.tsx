/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventAgendaItemDetailView } from '../EventAgendaItemDetailView';

const agendaElectionSectionMock = vi.hoisted(() =>
  vi.fn((props: { delegateTargetEventId?: string | null }) => (
    <div
      data-testid="agenda-election-section"
      data-delegate-target-event-id={props.delegateTargetEventId ?? ''}
    />
  ))
);
const agendaActionBarMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    void props;
    return <div data-testid="agenda-action-bar" />;
  })
);
const voteCastDialogMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="vote-cast-dialog">{props.documentPreviewContent as ReactNode}</div>
  ))
);
const changeRequestCardsListMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => {
    const items = (props.items as { id?: string }[] | undefined) ?? [];
    return (
      <div
        data-testid="change-request-cards-list"
        data-item-ids={items.map(item => item.id ?? '').join('|')}
      >
        {props.sequenceInterstitial as ReactNode}
      </div>
    );
  })
);
const amendmentBranchSelectorSectionMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div
      data-testid="amendment-branch-selector-section"
      data-selected-branch-id={(props.selectedBranchId as string | null | undefined) ?? ''}
    />
  ))
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    const href = to && params?.id ? to.replace('$id', params.id) : to;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../AgendaItemContextCard', () => ({
  AgendaItemContextCard: ({ presentation }: { presentation?: string }) => (
    <div data-testid="agenda-item-context-card" data-presentation={presentation} />
  ),
}));

vi.mock('../AgendaSpeakerListSection', () => ({
  AgendaSpeakerListSection: () => <div data-testid="agenda-speaker-list-section" />,
}));

vi.mock('../AgendaVoteSection', () => ({
  AgendaVoteSection: () => <div data-testid="agenda-vote-section" />,
}));

vi.mock('../AgendaElectionSection', () => ({
  AgendaElectionSection: agendaElectionSectionMock,
  isAutoAssignedRoleElection: () => false,
}));

vi.mock('../OfflineTallyDialog', () => ({
  OfflineTallyDialog: () => <div data-testid="offline-tally-dialog" />,
}));

vi.mock('../AgendaActionBar', () => ({
  AgendaActionBar: agendaActionBarMock,
}));

vi.mock('../EditElectionVoteDialog', () => ({
  EditElectionVoteDialog: () => <div data-testid="edit-election-vote-dialog" />,
}));

vi.mock('@/features/vote-cast/ui/VoteCastDialog', () => ({
  VoteCastDialog: voteCastDialogMock,
}));

vi.mock('@/features/elections/ui/CandidacyPasswordDialog', () => ({
  CandidacyPasswordDialog: () => <div data-testid="candidacy-password-dialog" />,
}));

vi.mock('../ChangeRequestCardsList', () => ({
  ChangeRequestCardsList: changeRequestCardsListMock,
}));

vi.mock('@/features/amendments/ui/AmendmentBranchSelectorSection', () => ({
  AmendmentBranchSelectorSection: amendmentBranchSelectorSectionMock,
}));

vi.mock('../MergeVariantComparisonPanel', () => ({
  MergeVariantComparisonPanel: () => <div data-testid="merge-variant-comparison-panel" />,
}));

vi.mock('../AccreditationSection', () => ({
  AccreditationSection: () => <div data-testid="accreditation-section" />,
}));

vi.mock('@/features/search/ui/EventSearchCard', () => ({
  EventSearchCard: () => <div data-testid="event-search-card" />,
}));

vi.mock('../NamedBallotResultsDialog', () => ({
  NamedBallotResultsDialog: () => <div data-testid="named-ballot-results-dialog" />,
}));

vi.mock('../../logic/offlineTallyToolbar', () => ({
  getOfflineTallyDialogTitle: () => 'Offline tally',
  getOfflineTallyTooltip: () => 'Offline tally',
}));

vi.mock('@/zero/shared', () => ({
  isNamedBallot: () => false,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildProps() {
  const noop = vi.fn();

  return {
    eventId: 'event-1',
    agendaItemId: 'agenda-item-1',
    t: (_key: string, fallback?: string) => fallback ?? _key,
    navigate: noop,
    updateSpeaker: noop,
    agendaItem: {
      id: 'agenda-item-1',
      title: 'Election: EventChair',
      description: '',
      type: 'election',
      status: 'pending',
      duration: 0,
      scheduled_time: null,
      start_time: null,
      end_time: null,
      activated_at: null,
      completed_at: null,
      amendment_id: null,
      amendment: null,
    },
    event: {
      id: 'event-1',
      title: 'TestEvent',
      status: 'active',
    },
    user: { id: 'user-1' },
    isLoading: false,
    votingLoading: null,
    addingSpeaker: false,
    election: {
      id: 'election-1',
      title: 'Election for EventChair',
      status: 'pending',
      election_mode: null,
      seat_count: null,
      max_votes: 1,
      closing_end_time: null,
      ballot_visibility: 'anonymous',
      offline_tallies: [],
    },
    candidates: [],
    vote: null,
    choices: [],
    userElector: null,
    userVoter: null,
    estimatedStartTime: null,
    forwardingContext: null,
    handleDelete: noop,
    handleAddToSpeakerList: noop,
    delegateAssignmentMeta: { targetEventId: 'target-event' },
    delegateTargetEvent: null,
    can: noop,
    canVote: noop,
    canBeCandidate: noop,
    canManageAgenda: false,
    canManageVotes: false,
    canJoinSpeakerList: false,
    canManageOfflineTallies: false,
    hasVotingRight: false,
    hasCandidateRight: false,
    rosterEvent: null,
    attendanceMode: 'online',
    disableVoteButton: false,
    allowsOfflineTallies: false,
    confirmedOfflineParticipantCount: 0,
    agendaNav: {
      hasPreviousItem: false,
      hasNextItem: false,
      hasStartableItem: false,
      canMoveToNextItem: false,
      isCurrentItemCompleted: false,
      moveToPreviousItem: noop,
      moveToNextItem: noop,
      completeCurrentItem: noop,
      isLoading: false,
    },
    verifyVotingPassword: noop,
    upsertElectionOfflineTally: noop,
    upsertVoteOfflineTally: noop,
    passwordError: null,
    setPasswordError: noop,
    isPasswordVerifying: false,
    setIsPasswordVerifying: noop,
    offlineTallyDialogOpen: false,
    setOfflineTallyDialogOpen: noop,
    offlineTallyPasswordError: null,
    setOfflineTallyPasswordError: noop,
    offlineTallySubmitError: null,
    setOfflineTallySubmitError: noop,
    isOfflineTallySubmitting: false,
    setIsOfflineTallySubmitting: noop,
    namedResultsTarget: null,
    setNamedResultsTarget: noop,
    effectiveVotingPhase: null,
    crTimeline: [],
    currentCRItem: null,
    completedItems: [],
    progress: 0,
    isTimelineComplete: false,
    allCRsProcessed: false,
    hasUserVotedOnCR: false,
    getUserSelectedChoiceIds: noop,
    startIndicativePhase: noop,
    startFinalPhase: noop,
    closeVoting: noop,
    castCRVote: noop,
    actionBarHook: {
      speakerLoading: false,
      handleLeaveSpeakerList: noop,
      isUserCandidate: false,
      candidateLoading: false,
      handleBecomeCandidate: noop,
      handleWithdrawCandidacy: noop,
      canManageAgenda: false,
      hasVotingRight: false,
      hasCandidateRight: false,
      isUserInSpeakerList: false,
      canJoinSpeakerList: false,
      handleJoinSpeakerList: noop,
      handleStartVote: noop,
      handleVoteClick: noop,
      handleEditClick: noop,
      candidacyDialogProps: {},
      voteDialogOpen: false,
      setVoteDialogOpen: noop,
      voteCasting: {
        phase: null,
        castAmendmentVote: noop,
        castElectionVote: noop,
        isLoading: false,
      },
      editDialogOpen: false,
      setEditDialogOpen: noop,
    },
    setMarkingSpeakerComplete: noop,
    selectedCRToolbarItemId: null,
    setSelectedCRToolbarItemId: noop,
    mockCRItems: [],
    documentContent: undefined,
    amendmentDiscussions: [],
    crDiffMap: {},
    hasAmendmentCRs: false,
    crDisplayItemsBase: [],
    isCRVotingActive: false,
    timelineHasClosingVote: false,
    synthesizedClosingVoteItem: null,
    crDisplayItems: [],
    effectiveClosingVoteItem: null,
    isVoteInCRList: false,
    nonFinalCRItems: [],
    fallbackSelectedCRItemId: null,
    selectedCRToolbarItem: null,
    currentCRSequenceItemId: null,
    nextStartableSequenceItem: null,
    isCRToolbarActive: false,
    selectedCRPhase: null,
    isSelectedClosingVote: false,
    hasUserVotedOnSelectedCR: false,
    selectedCRToolbarIndex: -1,
    hasPreviousChangeRequest: false,
    hasNextChangeRequest: false,
    handlePreviousChangeRequest: noop,
    handleNextChangeRequest: noop,
    handleJumpToNextStartableSequenceItem: noop,
    handleStartSequenceFinalVote: noop,
    handleToolbarStartVote: noop,
    handleToolbarStartFinalVote: noop,
    handleToolbarCloseVote: noop,
    handleCastCRVoteFromDialog: noop,
    selectedCRTitle: '',
    selectedCRChoices: [],
    selectedCRDialogPhase: null,
    agendaForwardingPreview: null,
    voteDialogForwardingPreview: null,
    mergeVariantCandidates: [],
    detailGroupTypeById: {},
    detailDerivedActiveStepRun: null,
    detailResolvedActiveBranchId: null,
    detailFirstUnresolvedStepId: null,
    detailPathVisualizationData: null,
    toolbarVotingPhase: null,
    toolbarAgendaItem: null,
    toolbarAgendaItemIndex: -1,
    toolbarAgendaItemTopNumber: null,
    detailRuntimeStatus: 'pending',
    handleToolbarStartItem: noop,
    startVoteTooltip: undefined,
    startFinalVoteTooltip: undefined,
    closeVoteTooltip: undefined,
    castIndicativeVoteTooltip: undefined,
    castFinalVoteTooltip: undefined,
    handleMarkSpeakerCompleted: noop,
    speakerListData: [],
    isUserInSpeakerList: false,
    activeRosterParticipants: [],
    isDelegateAssembly: false,
    participantsWithProvenance: [],
    eligibleParticipantsForNamedResults: [],
    confirmedOfflineParticipants: [],
    indicativeSelections: [],
    finalSelections: [],
    userHasElectionVoted: false,
    userSelectedCandidateIds: [],
    offlineTallyPhaseSource: null,
    offlineTallyPhase: null,
    indicativeDecisions: [],
    finalDecisions: [],
    userHasVoteVoted: false,
    userSelectedChoiceIds: [],
    namedElectionResults: null,
    namedVoteResults: null,
    namedResultsDialogConfig: null,
    offlineTallyEntity: null,
    offlineTallyActionMode: null,
    showOfflineTallyButton: false,
    handleOfflineTallyDialogOpenChange: noop,
    handleOpenOfflineTallyDialog: noop,
    handleSubmitOfflineTally: noop,
  };
}

describe('EventAgendaItemDetailView', () => {
  it('renders deduplicated details and speaker-list tabs below the shared header', () => {
    render(<EventAgendaItemDetailView {...buildProps()} />);

    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    const speakersTab = screen.getByRole('tab', { name: 'Speaker list' });
    expect(detailsTab.getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('agenda-item-context-card').dataset.presentation).toBe('embedded');

    fireEvent.mouseDown(speakersTab, { button: 0 });
    expect(speakersTab.getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('agenda-speaker-list-section')).toBeTruthy();
  });

  it('uses delegate assignment metadata as election target fallback', () => {
    render(<EventAgendaItemDetailView {...buildProps()} />);

    expect(
      screen.getByTestId('agenda-election-section').getAttribute('data-delegate-target-event-id')
    ).toBe('target-event');
    expect(agendaElectionSectionMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ delegateTargetEventId: 'target-event' })
    );
  });

  it('passes the vote dialog document preview content to the vote dialog', () => {
    render(
      <EventAgendaItemDetailView
        {...buildProps()}
        voteDialogDocumentPreviewContent={<div data-testid="dialog-document-preview" />}
      />
    );

    expect(screen.getByTestId('dialog-document-preview')).toBeTruthy();
    expect(voteCastDialogMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ documentPreviewContent: expect.anything() })
    );
  });

  it('keeps the tally action but hides the vote action for offline sequence votes', () => {
    const props = buildProps();
    const handleOpenOfflineTallyDialog = vi.fn();
    const handleVoteClick = vi.fn();

    render(
      <EventAgendaItemDetailView
        {...props}
        attendanceMode="offline"
        isCRToolbarActive
        toolbarVotingPhase="indication"
        selectedCRToolbarItem={{
          id: 'variant-sequence-item',
          vote: { id: 'variant-vote-1' },
        }}
        selectedCRChoices={[{ id: 'choice-yes', label: 'Yes' }]}
        showOfflineTallyButton
        handleOpenOfflineTallyDialog={handleOpenOfflineTallyDialog}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({
        showOfflineTallyButton: true,
        onOfflineTallyClick: handleOpenOfflineTallyDialog,
        onVoteClick: undefined,
      })
    );
  });

  it('keeps change request card vote actions visible but unavailable for offline event-suggestion votes', () => {
    const props = buildProps();
    const handleVoteClick = vi.fn();
    const crItem = {
      id: 'branch-1-cr-1',
      vote: { id: 'vote-cr-1' },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        attendanceMode="offline"
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'suggest_event' },
        }}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
        crDisplayItems={[crItem]}
        isCRVotingActive
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];
    const listProps = changeRequestCardsListMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(expect.objectContaining({ onVoteClick: undefined }));
    expect(listProps).toEqual(
      expect.objectContaining({
        canVote: false,
        voteDisabledTooltip:
          'Im Offline-Modus koennen keine Online-Stimmungsabgaben abgegeben werden. Wechsle fuer Indication Votes in den Online- oder Hybrid-Modus.',
      })
    );
    expect(typeof listProps?.onOpenVoteDialog).toBe('function');
    expect(handleVoteClick).not.toHaveBeenCalled();
  });

  it('keeps the vote action available for hybrid sequence votes', () => {
    const props = buildProps();
    const handleOpenOfflineTallyDialog = vi.fn();
    const handleVoteClick = vi.fn();

    render(
      <EventAgendaItemDetailView
        {...props}
        attendanceMode="hybrid"
        isCRToolbarActive
        toolbarVotingPhase="indication"
        selectedCRToolbarItem={{
          id: 'variant-sequence-item',
          vote: { id: 'variant-vote-1' },
        }}
        selectedCRChoices={[{ id: 'choice-yes', label: 'Yes' }]}
        showOfflineTallyButton
        handleOpenOfflineTallyDialog={handleOpenOfflineTallyDialog}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({
        showOfflineTallyButton: true,
        onOfflineTallyClick: handleOpenOfflineTallyDialog,
        onVoteClick: handleVoteClick,
      })
    );
  });

  it('hides the vote action for change request placeholders without choices', () => {
    const props = buildProps();
    const handleVoteClick = vi.fn();

    render(
      <EventAgendaItemDetailView
        {...props}
        attendanceMode="hybrid"
        isCRToolbarActive
        toolbarVotingPhase="indication"
        selectedCRToolbarItem={{
          id: 'agenda-vote-placeholder-change-request-votes',
          _voteStepKind: 'change_request_votes_placeholder',
          _votePlaceholder: true,
          vote: null,
        }}
        selectedCRChoices={[]}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({
        onVoteClick: undefined,
      })
    );
  });

  it('wires change request card final starts through the sequence-aware handler', () => {
    const props = buildProps();
    const handleStartSequenceFinalVote = vi.fn();
    const startFinalPhase = vi.fn();

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'event_final_closing_vote' },
        }}
        canManageVoteSequence
        detailRuntimeStatus="in-progress"
        isCRVotingActive
        crDisplayItems={[
          {
            id: 'agenda-vote-placeholder-change-request-votes',
            _voteStepKind: 'change_request_votes_placeholder',
            _votePlaceholder: true,
            vote: null,
          },
        ]}
        handleStartSequenceFinalVote={handleStartSequenceFinalVote}
        startFinalPhase={startFinalPhase}
      />
    );

    const listProps = changeRequestCardsListMock.mock.calls.at(-1)?.[0];

    expect(listProps).toEqual(
      expect.objectContaining({
        hideInlineVotingControls: true,
        onStartFinal: handleStartSequenceFinalVote,
      })
    );
    expect(listProps?.onStartFinal).not.toBe(startFinalPhase);
  });

  it('keeps the change request card vote dialog opener available before the agenda item is active', () => {
    const props = buildProps();
    const handleVoteClick = vi.fn();
    const setSelectedCRToolbarItemId = vi.fn();
    const crItem = {
      id: 'branch-2-cr-1',
      vote: { id: 'vote-cr-1' },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'event_final_closing_vote' },
        }}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
        crDisplayItems={[crItem]}
        detailRuntimeStatus="pending"
        isCRVotingActive
        setSelectedCRToolbarItemId={setSelectedCRToolbarItemId}
      />
    );

    const listProps = changeRequestCardsListMock.mock.calls.at(-1)?.[0];
    const onOpenVoteDialog = listProps?.onOpenVoteDialog;

    expect(typeof onOpenVoteDialog).toBe('function');

    if (typeof onOpenVoteDialog !== 'function') {
      throw new Error('Expected the change request vote dialog callback to be available');
    }
    onOpenVoteDialog(crItem.id);

    expect(setSelectedCRToolbarItemId).toHaveBeenCalledWith(crItem.id);
    expect(handleVoteClick).toHaveBeenCalledTimes(1);
  });

  it('does not expose the toolbar vote click for synthetic change request rows', () => {
    const props = buildProps();
    const handleVoteClick = vi.fn();
    const selectedCRToolbarItem = {
      id: 'mock-cr-cr-row-1',
      vote: {
        id: 'mock-vote-cr-row-1',
      },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'event_final_closing_vote' },
        }}
        actionBarHook={{
          ...props.actionBarHook,
          handleVoteClick,
        }}
        isCRToolbarActive
        isCRVotingActive
        selectedCRToolbarItem={selectedCRToolbarItem}
        selectedCRChoices={[{ id: 'mock-choice-yes-cr-row-1', label: 'Yes' }]}
        toolbarVotingPhase="indication"
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(expect.objectContaining({ onVoteClick: undefined }));
  });

  it('withholds change request final start controls until the agenda item is active', () => {
    const props = buildProps();
    const handleStartSequenceFinalVote = vi.fn();
    const handleToolbarStartFinalVote = vi.fn();
    const selectedCRToolbarItem = {
      id: 'branch-2-cr-1',
      vote: { id: 'vote-cr-1' },
    };
    const activeProps = {
      ...props,
      agendaItem: {
        ...props.agendaItem,
        amendment_id: 'amendment-1',
        amendment: { editing_mode: 'event_final_closing_vote' },
      },
      canManageVoteSequence: true,
      canStartSelectedCRFinalVote: true,
      crDisplayItems: [selectedCRToolbarItem],
      detailRuntimeStatus: 'pending',
      handleStartSequenceFinalVote,
      handleToolbarStartFinalVote,
      isCRToolbarActive: true,
      isCRVotingActive: true,
      selectedCRPhase: 'indication',
      selectedCRToolbarItem,
      selectedCRChoices: [{ id: 'choice-yes', label: 'Yes' }],
      toolbarVotingPhase: 'indication',
    };

    const { rerender } = render(<EventAgendaItemDetailView {...activeProps} />);

    let actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];
    let listProps = changeRequestCardsListMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(expect.objectContaining({ onStartFinalVote: undefined }));
    expect(listProps).toEqual(
      expect.objectContaining({
        canManage: false,
        onStartFinal: undefined,
      })
    );

    rerender(<EventAgendaItemDetailView {...activeProps} detailRuntimeStatus="in-progress" />);

    actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];
    listProps = changeRequestCardsListMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({ onStartFinalVote: handleToolbarStartFinalVote })
    );
    expect(listProps).toEqual(
      expect.objectContaining({
        canManage: true,
        onStartFinal: handleStartSequenceFinalVote,
      })
    );

    rerender(
      <EventAgendaItemDetailView
        {...activeProps}
        detailRuntimeStatus="in-progress"
        canStartSelectedCRFinalVote={false}
      />
    );

    actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];
    expect(actionBarProps).toEqual(expect.objectContaining({ onStartFinalVote: undefined }));
  });

  it('wires the top bar jump action to the next startable voting step', () => {
    const props = buildProps();
    const handleJumpToNextStartableSequenceItem = vi.fn();
    const selectedCRToolbarItem = {
      id: 'closed-cr',
      status: 'completed',
      vote: { id: 'vote-closed', status: 'closed' },
    };
    const nextStartableSequenceItem = {
      id: 'next-cr',
      status: 'voting',
      vote: { id: 'vote-next', status: 'indicative' },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'event_final_closing_vote' },
        }}
        canManageVoteSequence
        detailRuntimeStatus="in-progress"
        isCRToolbarActive
        isCRVotingActive
        selectedCRToolbarItem={selectedCRToolbarItem}
        nextStartableSequenceItem={nextStartableSequenceItem}
        toolbarVotingPhase="closed"
        handleJumpToNextStartableSequenceItem={handleJumpToNextStartableSequenceItem}
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({
        onJumpToNextVoteStep: handleJumpToNextStartableSequenceItem,
        jumpToNextVoteStepTooltip: 'Next voting step',
      })
    );

    const onJumpToNextVoteStep = actionBarProps?.onJumpToNextVoteStep;
    if (typeof onJumpToNextVoteStep !== 'function') {
      throw new Error('Expected the jump-to-next-vote-step callback to be available');
    }
    onJumpToNextVoteStep();

    expect(handleJumpToNextStartableSequenceItem).toHaveBeenCalledTimes(1);
  });

  it('does not expose the top bar jump action when the selected step is startable', () => {
    const props = buildProps();
    const handleJumpToNextStartableSequenceItem = vi.fn();
    const selectedCRToolbarItem = {
      id: 'selected-cr',
      status: 'voting',
      vote: { id: 'vote-selected', status: 'indicative' },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { editing_mode: 'event_final_closing_vote' },
        }}
        canManageVoteSequence
        detailRuntimeStatus="in-progress"
        isCRToolbarActive
        isCRVotingActive
        selectedCRToolbarItem={selectedCRToolbarItem}
        nextStartableSequenceItem={null}
        toolbarVotingPhase="indication"
        handleJumpToNextStartableSequenceItem={handleJumpToNextStartableSequenceItem}
      />
    );

    const actionBarProps = agendaActionBarMock.mock.calls.at(-1)?.[0];

    expect(actionBarProps).toEqual(
      expect.objectContaining({
        onJumpToNextVoteStep: undefined,
      })
    );
    expect(handleJumpToNextStartableSequenceItem).not.toHaveBeenCalled();
  });

  it('does not render the branch switcher when only one branch is selectable', () => {
    const props = buildProps();
    const branchBItem = {
      id: 'branch-b-cr',
      change_request_id: 'cr-branch-b',
      status: 'pending',
      is_closing_vote: false,
      change_request: {
        id: 'cr-branch-b',
        title: 'Branch B CR',
        process_branch_id: 'branch-b',
      },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { id: 'amendment-1', editing_mode: 'event_final_closing_vote' },
        }}
        branchSelectorBranches={[{ id: 'branch-b', created_at: 2, title: 'Branch B' }]}
        selectedBranchId="branch-b"
        onBranchChange={vi.fn()}
        crDisplayItems={[branchBItem]}
      />
    );

    expect(screen.queryByTestId('amendment-branch-selector-section')).toBeNull();
    expect(screen.getByTestId('change-request-cards-list').getAttribute('data-item-ids')).toBe(
      'branch-b-cr'
    );
    expect(changeRequestCardsListMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        items: [branchBItem],
        sequenceInterstitial: null,
      })
    );
  });

  it('renders the branch switcher inside the change request sequence for multiple selectable branches', () => {
    const props = buildProps();
    const onBranchChange = vi.fn();
    const branchBItem = {
      id: 'branch-b-cr',
      change_request_id: 'cr-branch-b',
      status: 'pending',
      is_closing_vote: false,
      change_request: {
        id: 'cr-branch-b',
        title: 'Branch B CR',
        process_branch_id: 'branch-b',
      },
    };

    render(
      <EventAgendaItemDetailView
        {...props}
        agendaItem={{
          ...props.agendaItem,
          amendment_id: 'amendment-1',
          amendment: { id: 'amendment-1', editing_mode: 'event_final_closing_vote' },
        }}
        branchSelectorBranches={[
          { id: 'branch-a', created_at: 1, title: 'Branch A' },
          { id: 'branch-b', created_at: 2, title: 'Branch B' },
        ]}
        selectedBranchId="branch-b"
        branchDiffCandidates={[]}
        defaultBranchDiffRightCandidateId="branch-b"
        onBranchChange={onBranchChange}
        crDisplayItems={[branchBItem]}
      />
    );

    expect(screen.getByTestId('amendment-branch-selector-section')).toBeTruthy();
    expect(
      screen
        .getByTestId('amendment-branch-selector-section')
        .getAttribute('data-selected-branch-id')
    ).toBe('branch-b');
    expect(screen.getByTestId('change-request-cards-list').getAttribute('data-item-ids')).toBe(
      'branch-b-cr'
    );
    expect(changeRequestCardsListMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        items: [branchBItem],
        sequenceInterstitial: expect.anything(),
      })
    );
    expect(amendmentBranchSelectorSectionMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        variant: 'inline',
        selectedBranchId: 'branch-b',
        onBranchChange,
      })
    );
  });
});
