/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
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
}));

vi.mock('../AgendaItemContextCard', () => ({
  AgendaItemContextCard: () => <div data-testid="agenda-item-context-card" />,
}));

vi.mock('../AgendaSpeakerListSection', () => ({
  AgendaSpeakerListSection: () => <div data-testid="agenda-speaker-list-section" />,
}));

vi.mock('../AgendaVoteSection', () => ({
  AgendaVoteSection: () => <div data-testid="agenda-vote-section" />,
}));

vi.mock('../AgendaElectionSection', () => ({
  AgendaElectionSection: agendaElectionSectionMock,
}));

vi.mock('../OfflineTallyDialog', () => ({
  OfflineTallyDialog: () => <div data-testid="offline-tally-dialog" />,
}));

vi.mock('../AgendaActionBar', () => ({
  AgendaActionBar: () => <div data-testid="agenda-action-bar" />,
}));

vi.mock('../EditElectionVoteDialog', () => ({
  EditElectionVoteDialog: () => <div data-testid="edit-election-vote-dialog" />,
}));

vi.mock('@/features/vote-cast/ui/VoteCastDialog', () => ({
  VoteCastDialog: () => <div data-testid="vote-cast-dialog" />,
}));

vi.mock('@/features/elections/ui/CandidacyPasswordDialog', () => ({
  CandidacyPasswordDialog: () => <div data-testid="candidacy-password-dialog" />,
}));

vi.mock('../ChangeRequestCardsList', () => ({
  ChangeRequestCardsList: () => <div data-testid="change-request-cards-list" />,
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
    timelineHasFinalVote: false,
    synthesizedFinalVoteItem: null,
    crDisplayItems: [],
    effectiveFinalVoteItem: null,
    isVoteInCRList: false,
    nonFinalCRItems: [],
    fallbackSelectedCRItemId: null,
    selectedCRToolbarItem: null,
    isCRToolbarActive: false,
    selectedCRPhase: null,
    isSelectedCRFinalVote: false,
    hasUserVotedOnSelectedCR: false,
    selectedCRToolbarIndex: -1,
    hasPreviousChangeRequest: false,
    hasNextChangeRequest: false,
    handlePreviousChangeRequest: noop,
    handleNextChangeRequest: noop,
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
  it('uses delegate assignment metadata as election target fallback', () => {
    render(<EventAgendaItemDetailView {...buildProps()} />);

    expect(
      screen.getByTestId('agenda-election-section').getAttribute('data-delegate-target-event-id')
    ).toBe('target-event');
    expect(agendaElectionSectionMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ delegateTargetEventId: 'target-event' })
    );
  });
});
