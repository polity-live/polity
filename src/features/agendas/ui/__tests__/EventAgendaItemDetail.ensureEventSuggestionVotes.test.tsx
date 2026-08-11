/* @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  closeExpiredFinalVotesForEvent: vi.fn(),
  ensureEventSuggestionChangeRequestVotes: vi.fn(),
  initializeChangeRequestVoting: vi.fn(),
  updateAgendaVote: vi.fn(),
  updateSpeaker: vi.fn(),
  upsertElectionOfflineTally: vi.fn(),
  upsertVoteOfflineTally: vi.fn(),
  verifyVotingPassword: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useAgendaArrowNavigation: vi.fn(),
  delegateComposition: {
    isDelegateAssembly: false,
    participantsWithProvenance: [] as Record<string, unknown>[],
  },
  cityDesigns: [] as Record<string, unknown>[],
  viewProps: [] as Record<string, unknown>[],
  extractSuggestionContent: vi.fn(),
  suggestionContentFromChangeRequestSnapshot: vi.fn(),
  hasRenderableSuggestionContent: vi.fn(),
  derivedActiveStep: null as Record<string, unknown> | null,
  firstUnresolvedStepId: null as string | null,
  forwardingPreview: null as Record<string, unknown> | null,
  useAgendaActionBar: vi.fn(),
  useAgendaItemCRVoting: vi.fn(),
  useAgendaNavigation: vi.fn(),
  useEventAgendaItem: vi.fn(),
  useEventById: vi.fn(),
  useEventParticipantsByParticipatedEventIds: vi.fn(),
  usePermissions: vi.fn(),
  useUserState: vi.fn(),
}));

vi.mock('katex/dist/katex.min.css', () => ({}));

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({
  CREditorPreview: () => null,
}));

vi.mock('@/features/change-requests/utils/suggestion-extraction', () => ({
  extractSuggestionContent: (...args: unknown[]) => mocks.extractSuggestionContent(...args),
  suggestionContentFromChangeRequestSnapshot: (...args: unknown[]) =>
    mocks.suggestionContentFromChangeRequestSnapshot(...args),
  hasRenderableSuggestionContent: (...args: unknown[]) =>
    mocks.hasRenderableSuggestionContent(...args),
}));

vi.mock('@/features/amendments/logic/buildAmendmentPathVisualizationData', () => ({
  buildAmendmentPathGroupTypeById: () => ({ group: 'base' }),
  findLikelyActiveAmendmentStep: () => mocks.derivedActiveStep,
  getFirstUnresolvedAmendmentStepId: () => mocks.firstUnresolvedStepId,
  buildAmendmentPathVisualizationData: (
    steps: Record<string, unknown>[],
    options: {
      activeStepId: string | null;
      isEventRequestPending: (step: Record<string, unknown>) => boolean;
    }
  ) => ({
    activeStepId: options.activeStepId,
    pendingStates: steps.map(step => options.isEventRequestPending(step)),
  }),
}));

vi.mock('@/features/amendments/logic/amendmentForwardingPreview', () => ({
  buildAmendmentForwardingPreview: () => mocks.forwardingPreview,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock('../../hooks/useEventAgendaItem', () => ({
  useEventAgendaItem: (...args: unknown[]) => mocks.useEventAgendaItem(...args),
}));

vi.mock('../../hooks/useAgendaActionBar', () => ({
  useAgendaActionBar: (...args: unknown[]) => mocks.useAgendaActionBar(...args),
}));

vi.mock('../../hooks/useAgendaNavigation', () => ({
  useAgendaNavigation: (...args: unknown[]) => mocks.useAgendaNavigation(...args),
}));

vi.mock('../../hooks/useAgendaItemCRVoting', () => ({
  getVotePhase: (item: { vote?: { status?: string | null } }) =>
    item.vote?.status === 'closed'
      ? 'closed'
      : item.vote?.status === 'final'
        ? 'final'
        : 'indicative',
  getVoteResult: () => 'pending',
  useAgendaItemCRVoting: (...args: unknown[]) => mocks.useAgendaItemCRVoting(...args),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    updateSpeaker: mocks.updateSpeaker,
    initializeChangeRequestVoting: mocks.initializeChangeRequestVoting,
    ensureEventSuggestionChangeRequestVotes: mocks.ensureEventSuggestionChangeRequestVotes,
  }),
}));

vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    updateVote: mocks.updateAgendaVote,
    upsertOfflineTally: mocks.upsertVoteOfflineTally,
    closeExpiredFinalVotesForEvent: mocks.closeExpiredFinalVotesForEvent,
  }),
}));

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    upsertOfflineTally: mocks.upsertElectionOfflineTally,
  }),
}));

vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({
    verifyVotingPassword: mocks.verifyVotingPassword,
  }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: (...args: unknown[]) => mocks.useUserState(...args),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ cityDesigns: mocks.cityDesigns }),
}));

vi.mock('@/zero/events', () => ({
  useEventById: (...args: unknown[]) => mocks.useEventById(...args),
  useEventParticipantsByParticipatedEventIds: (...args: unknown[]) =>
    mocks.useEventParticipantsByParticipatedEventIds(...args),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: (...args: unknown[]) => mocks.usePermissions(...args),
}));

vi.mock('@/features/events/hooks/useDelegateAssemblyParticipantsComposition', () => ({
  useDelegateAssemblyParticipantsComposition: () => mocks.delegateComposition,
}));

vi.mock('../../hooks/useAgendaArrowNavigation', () => ({
  useAgendaArrowNavigation: (...args: unknown[]) => mocks.useAgendaArrowNavigation(...args),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: async (value: unknown) => value,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../EventAgendaItemDetailView', () => ({
  EventAgendaItemDetailView: (props: Record<string, unknown>) => {
    mocks.viewProps.push(props);
    return null;
  },
}));

import {
  addTimelineIdentityKey,
  collectCRSummaryIdentityKeys,
  collectTimelineItemIdentityKeys,
  EventAgendaItemDetail,
} from '../EventAgendaItemDetail';

type ViewRow = Record<string, unknown>;

function latestViewProps(): ViewRow {
  return mocks.viewProps.at(-1) ?? {};
}

function viewProp<T>(name: string): T {
  return latestViewProps()[name] as T;
}

function createForwardingContext() {
  const currentStepRun = {
    id: 'step-1',
    agenda_item_id: 'agenda-1',
    branch_id: 'branch-1',
    order_index: 0,
    step_kind: 'group_vote',
    branch: { id: 'branch-1', created_at: 1 },
  };

  return {
    agendaStepRuns: [currentStepRun],
    branchStepRuns: [],
    currentStepRun,
    nextStepRun: null,
    processRun: { id: 'run-1', active_branch_id: 'branch-1' },
    processRunStepRuns: [],
  };
}

function createAgendaItem(branchEditingMode: string) {
  return {
    id: 'agenda-1',
    event_id: 'event-1',
    title: 'Agenda item',
    description: null,
    type: 'amendment',
    status: 'in-progress',
    amendment_id: 'amendment-1',
    amendment: {
      id: 'amendment-1',
      title: 'Amendment',
      document: { content: [] },
      current_process_run: {
        id: 'run-1',
        active_branch_id: 'branch-1',
        branches: [
          {
            id: 'branch-1',
            created_at: 1,
            editing_mode: branchEditingMode,
            change_requests: [
              {
                id: 'cr-1',
                amendment_id: 'amendment-1',
                process_branch_id: 'branch-1',
                status: 'open',
                voting_status: 'open',
                title: 'CR-1',
                created_at: 1,
              },
            ],
            discussions: [],
            document: { content: [] },
          },
        ],
      },
    },
  };
}

function setDefaultMocks(branchEditingMode = 'suggest_event') {
  mocks.closeExpiredFinalVotesForEvent.mockResolvedValue(undefined);
  mocks.ensureEventSuggestionChangeRequestVotes.mockResolvedValue(undefined);
  mocks.initializeChangeRequestVoting.mockResolvedValue(undefined);
  mocks.updateAgendaVote.mockResolvedValue(undefined);
  mocks.updateSpeaker.mockResolvedValue(undefined);
  mocks.upsertElectionOfflineTally.mockResolvedValue(undefined);
  mocks.upsertVoteOfflineTally.mockResolvedValue(undefined);
  mocks.verifyVotingPassword.mockResolvedValue(undefined);
  mocks.extractSuggestionContent.mockReturnValue(null);
  mocks.suggestionContentFromChangeRequestSnapshot.mockReturnValue(null);
  mocks.hasRenderableSuggestionContent.mockImplementation(value => value !== null);
  mocks.useEventAgendaItem.mockReturnValue({
    agendaItem: createAgendaItem(branchEditingMode),
    event: { id: 'event-1', title: 'Event', status: 'active' },
    user: { id: 'user-1' },
    isLoading: false,
    votingLoading: null,
    addingSpeaker: false,
    election: null,
    candidates: [],
    vote: null,
    votesByAgendaItem: [],
    choices: [],
    userElector: null,
    userVoter: null,
    estimatedStartTime: null,
    forwardingContext: createForwardingContext(),
    handleDelete: vi.fn(),
    handleAddToSpeakerList: vi.fn(),
    canJoinSpeakerList: false,
  });
  mocks.useUserState.mockReturnValue({ user: null });
  mocks.useEventById.mockReturnValue({ event: null });
  mocks.useEventParticipantsByParticipatedEventIds.mockReturnValue({ participants: [] });
  mocks.usePermissions.mockReturnValue({
    can: vi.fn(() => false),
    canVote: vi.fn(() => true),
    canBeCandidate: vi.fn(() => false),
  });
  mocks.useAgendaItemCRVoting.mockReturnValue({
    crTimeline: [],
    currentItem: null,
    progress: 0,
    isTimelineComplete: false,
    allCRsProcessed: false,
    hasUserVoted: vi.fn(() => false),
    getUserSelectedChoiceIds: vi.fn(() => []),
    startIndicativePhase: vi.fn(),
    startFinalPhase: vi.fn(),
    closeVoting: vi.fn(),
    castCRVote: vi.fn(),
  });
  mocks.useAgendaActionBar.mockReturnValue({
    canJoinSpeakerList: false,
    canManageAgenda: false,
    candidateLoading: false,
    candidacyDialogProps: {},
    disableSecretIndicativeVoteButton: false,
    editDialogOpen: false,
    handleBecomeCandidate: vi.fn(),
    handleCloseFinalVote: vi.fn(),
    handleEditClick: vi.fn(),
    handleJoinSpeakerList: vi.fn(),
    handleLeaveSpeakerList: vi.fn(),
    handleStartFinalVote: vi.fn(),
    handleStartVote: vi.fn(),
    handleVoteClick: vi.fn(),
    handleWithdrawCandidacy: vi.fn(),
    hasCandidateRight: false,
    hasVotingRight: true,
    isUserCandidate: false,
    isUserInSpeakerList: false,
    secretIndicativeVoteTooltip: undefined,
    setEditDialogOpen: vi.fn(),
    setVoteDialogOpen: vi.fn(),
    speakerLoading: false,
    voteCasting: {
      castAmendmentVote: vi.fn(),
      castElectionVote: vi.fn(),
      isLoading: false,
      phase: null,
    },
    voteDialogOpen: false,
  });
  mocks.useAgendaNavigation.mockReturnValue({
    canMoveToNextItem: false,
    completeCurrentItem: vi.fn(),
    hasNextItem: false,
    hasPreviousItem: false,
    hasStartableItem: false,
    isCurrentItemCompleted: false,
    isLoading: false,
    moveToNextItem: vi.fn(),
    moveToPreviousItem: vi.fn(),
    activateAgendaItem: vi.fn().mockResolvedValue(undefined),
    currentAgendaItem: null,
    currentIndex: -1,
  });
}

beforeEach(() => {
  Object.values(mocks).forEach(value => {
    if (typeof value === 'function' && 'mockReset' in value) {
      (value as ReturnType<typeof vi.fn>).mockReset();
    }
  });
  mocks.viewProps.length = 0;
  mocks.cityDesigns = [];
  mocks.delegateComposition = { isDelegateAssembly: false, participantsWithProvenance: [] };
  mocks.derivedActiveStep = null;
  mocks.firstUnresolvedStepId = null;
  mocks.forwardingPreview = null;
  setDefaultMocks();
});

afterEach(() => {
  cleanup();
});

describe('EventAgendaItemDetail event-suggestion CR votes', () => {
  it('collects all supported timeline identities and safe title fallbacks', () => {
    const directKeys = new Set<string>();
    addTimelineIdentityKey(directKeys, null);
    addTimelineIdentityKey(directKeys, {});
    addTimelineIdentityKey(directKeys, '   ');
    addTimelineIdentityKey(directKeys, 12);
    expect([...directKeys]).toEqual(['12']);

    expect(
      collectTimelineItemIdentityKeys({
        processBranchId: 'branch-alias',
        logicalKey: 'logical-alias',
        suggestionId: 'suggestion-alias',
        discussionId: 'discussion-alias',
        change_request: {},
      })
    ).toEqual(
      new Set([
        'suggestion-alias',
        'discussion-alias',
        'logical-alias',
        'branch-alias:logical-alias',
      ])
    );
    expect(
      collectTimelineItemIdentityKeys({
        _processBranchId: 'branch-private',
        change_request: { logical_key: 'logical-snapshot' },
      })
    ).toEqual(new Set(['logical-snapshot', 'branch-private:logical-snapshot']));
    expect(
      collectTimelineItemIdentityKeys({
        change_request: { processBranchId: 'branch-cr', logicalKey: 'logical-cr' },
      })
    ).toEqual(new Set(['logical-cr', 'branch-cr:logical-cr']));
    expect(
      collectTimelineItemIdentityKeys({ change_request: { title: 'Title fallback' } })
    ).toEqual(new Set(['Title fallback']));
    expect(collectTimelineItemIdentityKeys({})).toEqual(new Set());

    expect(
      collectCRSummaryIdentityKeys({
        id: 'summary-1',
        processBranchId: 'branch-1',
        logicalKey: 'logical-1',
      })
    ).toEqual(new Set(['summary-1', 'logical-1', 'branch-1:logical-1']));
    expect(collectCRSummaryIdentityKeys({ title: 'Summary fallback' })).toEqual(
      new Set(['Summary fallback'])
    );
    expect(collectCRSummaryIdentityKeys({ processBranchId: 'branch-only' })).toEqual(new Set());
  });

  it('materializes confirmed suggest-event change requests for the selected branch', async () => {
    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    await waitFor(() =>
      expect(mocks.ensureEventSuggestionChangeRequestVotes).toHaveBeenCalledWith({
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: 'branch-1',
      })
    );
  });

  it('does not materialize change request votes outside suggest_event mode', async () => {
    setDefaultMocks('event_final_closing_vote');

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    await waitFor(() => expect(mocks.closeExpiredFinalVotesForEvent).toHaveBeenCalled());
    expect(mocks.ensureEventSuggestionChangeRequestVotes).not.toHaveBeenCalled();
  });

  it('publishes deterministic empty-state controller props and delegates standalone actions', async () => {
    const handleStartFinalVote = vi.fn().mockResolvedValue(undefined);
    const handleCloseFinalVote = vi.fn().mockResolvedValue(undefined);
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem: null,
      event: null,
      user: null,
      isLoading: true,
      votingLoading: null,
      addingSpeaker: false,
      election: null,
      candidates: [],
      vote: null,
      votesByAgendaItem: null,
      choices: [],
      userElector: null,
      userVoter: null,
      estimatedStartTime: null,
      forwardingContext: {
        agendaStepRuns: null,
        branchStepRuns: [],
        currentStepRun: null,
        nextStepRun: null,
        processRun: null,
        processRunStepRuns: [],
      },
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: false,
    });
    mocks.useAgendaActionBar.mockReturnValue({
      ...mocks.useAgendaActionBar(),
      handleStartFinalVote,
      handleCloseFinalVote,
    });

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    expect(latestViewProps()).toMatchObject({
      agendaItem: null,
      userRecord: undefined,
      detailRuntimeStatus: 'pending',
      toolbarAgendaItemIndex: -1,
      toolbarAgendaItemTopNumber: undefined,
      selectedCRToolbarItem: null,
      selectedCRToolbarIndex: -1,
      hasPreviousChangeRequest: false,
      hasNextChangeRequest: false,
      progress: 0,
    });
    await expect(
      viewProp<() => Promise<void>>('handleToolbarStartItem')()
    ).resolves.toBeUndefined();
    viewProp<() => void>('handlePreviousChangeRequest')();
    viewProp<() => void>('handleNextChangeRequest')();
    viewProp<() => void>('handleJumpToNextStartableSequenceItem')();
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('missing');
    await viewProp<(id: string) => Promise<void>>('startIndicativePhase')('missing');
    await viewProp<(id: string) => Promise<void>>('handleCastCRVoteFromDialog')('choice');
    await viewProp<(input: { password: string; counts: Record<string, number> }) => Promise<void>>(
      'handleSubmitOfflineTally'
    )({ password: '1234', counts: {} });
    await viewProp<(id: string) => Promise<void>>('handleMarkSpeakerCompleted')('speaker');
    viewProp<() => void>('handleToolbarStartVote')();
    viewProp<() => void>('handleToolbarStartFinalVote')();
    viewProp<() => void>('handleToolbarCloseVote')();
    await act(async () => Promise.resolve());
    expect(handleStartFinalVote).toHaveBeenCalledOnce();
    expect(handleCloseFinalVote).toHaveBeenCalledOnce();
  });

  it('orchestrates a branch-scoped change-request sequence and speaker completion', async () => {
    const castCRVote = vi.fn().mockResolvedValue(undefined);
    const closeVoting = vi.fn().mockResolvedValue(undefined);
    const startFinalPhase = vi.fn().mockResolvedValue(undefined);
    const startIndicativePhase = vi.fn().mockResolvedValue(undefined);
    const crItem = {
      id: 'timeline-cr-1',
      agenda_item_id: 'agenda-1',
      process_branch_id: 'branch-1',
      change_request_id: 'change-request-1',
      _voteStepKind: 'change_request',
      is_closing_vote: false,
      order_index: 0,
      status: 'voting',
      change_request: {
        id: 'change-request-1',
        title: 'Improve section',
        process_branch_id: 'branch-1',
      },
      vote_id: 'cr-vote-1',
      vote: {
        id: 'cr-vote-1',
        status: 'indicative',
        choices: [
          { id: 'accept', label: 'Accept' },
          { id: 'reject', label: '' },
        ],
      },
    };
    const closingItem = {
      id: 'timeline-closing',
      agenda_item_id: 'agenda-1',
      process_branch_id: 'branch-1',
      is_closing_vote: true,
      order_index: 1,
      status: 'pending',
      vote_id: 'closing-vote-1',
      vote: {
        id: 'closing-vote-1',
        status: 'indicative',
        choices: [{ id: 'yes', label: 'Yes' }],
      },
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [crItem, closingItem],
      currentItem: crItem,
      progress: 0.5,
      isTimelineComplete: false,
      allCRsProcessed: false,
      hasUserVoted: vi.fn(() => true),
      getUserSelectedChoiceIds: vi.fn(() => ['accept']),
      startIndicativePhase,
      startFinalPhase,
      closeVoting,
      castCRVote,
    });
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => true),
      canVote: vi.fn(() => true),
      canBeCandidate: vi.fn(() => true),
    });
    mocks.useUserState.mockReturnValue({
      user: {
        id: 'user-1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.test',
        avatar: 'avatar.png',
        gender: 'female',
      },
    });
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    agendaItem.order_index = 2;
    agendaItem.start_time = 1;
    agendaItem.speaker_list = [
      {
        id: 'speaker-1',
        order_index: 1,
        time: 5,
        completed: false,
        title: 'First',
        start_time: 1,
        end_time: null,
        user: {
          id: 'user-1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.test',
          avatar: 'avatar.png',
          gender: 'female',
        },
      },
      { id: 'speaker-2', order_index: 2, time: 0, completed: false, user: null },
    ];
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem,
      event: {
        id: 'event-1',
        title: 'Event',
        status: 'active',
        current_agenda_item_id: 'agenda-1',
        gender_quota_enabled: true,
      },
      user: { id: 'user-1' },
      isLoading: false,
      votingLoading: null,
      addingSpeaker: false,
      election: null,
      candidates: [],
      vote: null,
      votesByAgendaItem: [],
      choices: [],
      userElector: null,
      userVoter: null,
      estimatedStartTime: 1,
      forwardingContext: createForwardingContext(),
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: true,
    });
    mocks.forwardingPreview = { label: 'Forward' };

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    expect(latestViewProps()).toMatchObject({
      canManageAgenda: true,
      canManageVotes: true,
      hasVotingRight: true,
      hasCandidateRight: true,
      isCRToolbarActive: true,
      hasUserVotedOnSelectedCR: true,
      selectedCRToolbarIndex: 0,
      hasPreviousChangeRequest: false,
      hasNextChangeRequest: true,
      selectedCRTitle: 'Branch 1 CR-1',
      selectedCRChoices: [
        { id: 'accept', label: 'Accept' },
        { id: 'reject', label: 'features.agendas.fallbacks.choice' },
      ],
      selectedCRDialogPhase: 'indication',
      toolbarAgendaItemIndex: 1,
      toolbarAgendaItemTopNumber: 2,
      showSpeakerGender: true,
      isUserInSpeakerList: true,
    });
    await viewProp<(choice: string, context: { phase: string }) => Promise<void>>(
      'handleCastCRVoteFromDialog'
    )('accept', { phase: 'indicative' });
    expect(castCRVote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'timeline-cr-1' }),
      'accept',
      { phase: 'indicative' }
    );

    await viewProp<(id: string) => Promise<void>>('startIndicativePhase')('timeline-cr-1');
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith({ id: 'cr-vote-1', status: 'indicative' });
    viewProp<() => void>('handleToolbarStartVote')();
    viewProp<() => void>('handleToolbarStartFinalVote')();
    await act(async () => Promise.resolve());
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith({ id: 'cr-vote-1', status: 'final' });
    viewProp<() => void>('handleToolbarCloseVote')();
    await act(async () => Promise.resolve());
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cr-vote-1', status: 'closed' })
    );

    act(() => viewProp<(id: string) => void>('setSelectedCRToolbarItemId')('timeline-closing'));
    expect(latestViewProps()).toMatchObject({
      isSelectedClosingVote: true,
      selectedCRTitle: 'features.agendas.crTimeline.acceptAmendment',
      hasPreviousChangeRequest: true,
      hasNextChangeRequest: false,
      voteDialogForwardingPreview: { label: 'Forward' },
    });
    act(() => viewProp<() => void>('handleNextChangeRequest')());
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('timeline-closing');
    act(() => viewProp<() => void>('handlePreviousChangeRequest')());
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('timeline-cr-1');
    act(() => viewProp<() => void>('handlePreviousChangeRequest')());
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('timeline-cr-1');
    act(() => viewProp<() => void>('handleNextChangeRequest')());
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('timeline-closing');

    await viewProp<(id: string) => Promise<void>>('handleMarkSpeakerCompleted')('speaker-1');
    expect(mocks.updateSpeaker).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it('synthesizes variant, skipped-change-request and closing vote sequence items', async () => {
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => true),
      canVote: vi.fn(() => true),
      canBeCandidate: vi.fn(() => false),
    });
    const variantVote = {
      id: 'variant-vote',
      purpose: 'merge_variant',
      status: 'indicative',
      title: null,
      choices: [{ id: 'variant-a', label: 'Variant A' }],
    };
    const closingVote = {
      id: 'closing-vote',
      purpose: 'closing',
      status: 'indicative',
      title: null,
      choices: [{ id: 'yes', label: 'Yes' }],
    };
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    const processRun = amendment.current_process_run as ViewRow;
    processRun.branches = [];
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem,
      event: { id: 'event-1', title: 'Event', status: 'active' },
      user: { id: 'user-1' },
      isLoading: false,
      votingLoading: null,
      addingSpeaker: false,
      election: null,
      candidates: [],
      vote: null,
      votesByAgendaItem: [variantVote, closingVote],
      choices: [],
      userElector: null,
      userVoter: null,
      estimatedStartTime: null,
      forwardingContext: createForwardingContext(),
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: false,
    });
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [],
      currentItem: null,
      progress: 0,
      isTimelineComplete: false,
      allCRsProcessed: false,
      hasUserVoted: vi.fn(() => false),
      getUserSelectedChoiceIds: vi.fn(() => []),
      startIndicativePhase: vi.fn(),
      startFinalPhase: vi.fn(),
      closeVoting: vi.fn(),
      castCRVote: vi.fn(),
    });

    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    const items = viewProp<ViewRow[]>('crDisplayItems');
    expect(items).toHaveLength(3);
    const variantItem = items.find(item => item._voteStepKind === 'merge_variant') as ViewRow;
    const changeRequestPlaceholder = items.find(
      item => item._voteStepKind === 'change_request_votes_placeholder'
    ) as ViewRow;
    expect(changeRequestPlaceholder.status).toBe('pending');

    act(() =>
      viewProp<(id: string) => void>('setSelectedCRToolbarItemId')(variantItem.id as string)
    );
    expect(viewProp<string>('selectedCRTitle')).toBe('features.agendas.fallbacks.variantFinalVote');
    act(() =>
      viewProp<(id: string) => void>('setSelectedCRToolbarItemId')(
        changeRequestPlaceholder.id as string
      )
    );
    expect(viewProp<string>('selectedCRTitle')).toBe('Change request votes');
    await act(async () =>
      viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')(
        changeRequestPlaceholder.id as string
      )
    );
    expect(viewProp<ViewRow>('selectedCRToolbarItem').is_closing_vote).toBe(true);

    closingVote.status = 'final';
    const previousHookResult = mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({
      ...previousHookResult,
      votesByAgendaItem: [variantVote, { ...closingVote }],
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(
      viewProp<ViewRow[]>('crDisplayItems').find(
        item => item._voteStepKind === 'change_request_votes_placeholder'
      )?.status
    ).toBe('completed');
  });

  it('initializes a missing closing vote after a variant and reports jump failures', async () => {
    const variantVote = {
      id: 'variant-only-vote',
      purpose: 'merge_variant',
      status: 'indicative',
      choices: [{ id: 'variant-a', label: 'Variant A' }],
    };
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    (amendment.current_process_run as ViewRow).branches = [];
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem,
      event: { id: 'event-1', title: 'Event', status: 'active' },
      user: { id: 'user-1' },
      isLoading: false,
      votingLoading: null,
      addingSpeaker: false,
      election: null,
      candidates: [],
      vote: null,
      votesByAgendaItem: [variantVote],
      choices: [],
      userElector: null,
      userVoter: null,
      estimatedStartTime: null,
      forwardingContext: createForwardingContext(),
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: false,
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    const placeholder = viewProp<ViewRow[]>('crDisplayItems').find(
      item => item._voteStepKind === 'change_request_votes_placeholder'
    ) as ViewRow;
    expect(
      viewProp<ViewRow[]>('crDisplayItems').some(
        item => item._voteStepKind === 'closing_placeholder'
      )
    ).toBe(true);
    act(() =>
      viewProp<(id: string) => void>('setSelectedCRToolbarItemId')(placeholder.id as string)
    );
    viewProp<() => void>('handleToolbarCloseVote')();
    await act(async () => Promise.resolve());

    mocks.initializeChangeRequestVoting.mockRejectedValueOnce(new Error('initialize failed'));
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')(
      placeholder.id as string
    );
    expect(mocks.toastError).toHaveBeenCalled();
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')(
      placeholder.id as string
    );
    expect(mocks.initializeChangeRequestVoting).toHaveBeenCalledWith({
      amendment_id: 'amendment-1',
      agenda_item_id: 'agenda-1',
      start_final_vote_if_no_change_requests: false,
    });

    const plainItem = {
      id: 'plain-cr',
      agenda_item_id: 'agenda-1',
      process_branch_id: null,
      is_closing_vote: false,
      order_index: 0,
      status: 'pending',
      vote: { id: 'plain-vote', status: 'indicative', choices: [] },
    };
    const startIndicativePhase = vi.fn().mockResolvedValue(undefined);
    const startFinalPhase = vi.fn().mockResolvedValue(undefined);
    const closeVoting = vi.fn().mockResolvedValue(undefined);
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [plainItem],
      currentItem: plainItem,
      progress: 0,
      isTimelineComplete: false,
      allCRsProcessed: false,
      hasUserVoted: vi.fn(() => false),
      getUserSelectedChoiceIds: vi.fn(() => []),
      startIndicativePhase,
      startFinalPhase,
      closeVoting,
      castCRVote: vi.fn(),
    });
    variantVote.status = 'closed';
    const previousHookResult = mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({
      ...previousHookResult,
      votesByAgendaItem: [{ ...variantVote }],
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('crDisplayItems').map(item => item.id)).toContain('plain-cr');
    act(() => viewProp<(id: string) => void>('setSelectedCRToolbarItemId')('plain-cr'));
    expect(viewProp<boolean>('canStartSelectedCRFinalVote')).toBe(true);
    await act(async () =>
      viewProp<(id: string) => Promise<void>>('startIndicativePhase')('plain-cr')
    );
    expect(startIndicativePhase).toHaveBeenCalledWith('plain-cr');
    await act(async () =>
      viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('plain-cr')
    );
    expect(startFinalPhase).toHaveBeenCalledWith('plain-cr');
    await viewProp<() => Promise<void>>('handleToolbarCloseVote')();
    expect(closeVoting).toHaveBeenCalledWith('plain-cr');

    startFinalPhase.mockRejectedValueOnce(new Error('final failed'));
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('plain-cr');
    startFinalPhase.mockRejectedValueOnce('unknown failure');
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('plain-cr');
    expect(mocks.toastError).toHaveBeenCalledTimes(3);
  });

  it('derives final election state and saves deterministic offline election tallies', async () => {
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => true),
      canVote: vi.fn(() => true),
      canBeCandidate: vi.fn(() => true),
    });
    const rosterEvent = {
      id: 'event-1',
      attendance_mode: 'hybrid',
      location_type: 'physical',
      participants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          status: 'active',
          user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
        },
        { id: 'participant-2', user_id: 'user-2', status: 'revoked', user: null },
      ],
      offline_participants: [
        {
          id: 'offline-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
          display_name: 'Offline One',
        },
        {
          id: 'offline-2',
          attendance_status: 'pending',
          participation_channel: 'offline',
        },
      ],
    };
    mocks.useEventById.mockImplementation((reference?: string) => ({
      event: reference === 'event-1' ? rosterEvent : null,
    }));
    mocks.useEventParticipantsByParticipatedEventIds.mockReturnValue({
      participants: rosterEvent.participants,
    });
    const candidates = [
      {
        id: 'candidate-a',
        status: 'active',
        user: { first_name: 'Alex', last_name: 'Alpha' },
      },
      { id: 'candidate-b', status: 'active', name: 'Beta' },
      { id: 'candidate-c', status: 'active', name: 'Gamma' },
    ];
    const election = {
      id: 'election-1',
      title: null,
      status: 'final',
      max_votes: 2,
      candidates,
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      electorate_snapshotted_at: 1,
      indicative_selections: [{ id: 'indicative-selection' }],
      final_selections: [{ id: 'final-selection' }],
      final_participations: [
        {
          elector_id: 'elector-1',
          selections: [
            { candidate: { id: 'candidate-a' } },
            { candidate_id: 'candidate-b' },
            { candidate_id: null },
          ],
        },
      ],
      indicative_participations: [],
      offline_tallies: [
        { phase: 'final', candidate_id: 'candidate-a', count: 1 },
        { phase: 'final', candidate_id: 'candidate-b', count: null },
      ],
    };
    const agendaItem = {
      id: 'agenda-election',
      event_id: 'event-1',
      title: null,
      description: null,
      type: 'election',
      status: 'in-progress',
      voting_phase: 'final',
      amendment_id: null,
      amendment: null,
      speaker_list: [],
      order_index: 1,
    };
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem,
      event: { id: 'event-1', title: null, status: 'active' },
      user: { id: 'user-1' },
      isLoading: false,
      votingLoading: null,
      addingSpeaker: false,
      election,
      candidates,
      vote: null,
      votesByAgendaItem: [],
      choices: [],
      userElector: { id: 'elector-1' },
      userVoter: null,
      estimatedStartTime: null,
      forwardingContext: createForwardingContext(),
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: false,
    });

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-election" />);

    expect(latestViewProps()).toMatchObject({
      attendanceMode: 'hybrid',
      allowsOfflineTallies: true,
      confirmedOfflineParticipantCount: 1,
      eligibleFinalVoterCount: 1,
      indicativeSelections: [{ id: 'indicative-selection' }],
      finalSelections: [{ id: 'final-selection' }],
      userHasElectionVoted: true,
      userSelectedCandidateIds: ['candidate-a', 'candidate-b'],
      offlineTallyPhase: 'final',
      offlineTallyActionMode: 'edit',
      showOfflineTallyButton: true,
    });
    act(() => viewProp<() => void>('handleOpenOfflineTallyDialog')());
    expect(viewProp<boolean>('offlineTallyDialogOpen')).toBe(true);
    await act(async () =>
      viewProp<(input: { password: string; counts: Record<string, number> }) => Promise<void>>(
        'handleSubmitOfflineTally'
      )({ password: '1234', counts: { 'candidate-a': 2, 'candidate-c': 1 } })
    );
    expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('1234');
    expect(mocks.upsertElectionOfflineTally).toHaveBeenCalledTimes(3);
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(viewProp<boolean>('offlineTallyDialogOpen')).toBe(false);

    act(() => viewProp<(open: boolean) => void>('handleOfflineTallyDialogOpenChange')(true));
    act(() => viewProp<(value: string | null) => void>('setOfflineTallyPasswordError')('old'));
    act(() => viewProp<(value: string | null) => void>('setOfflineTallySubmitError')('old'));
    act(() => viewProp<(open: boolean) => void>('handleOfflineTallyDialogOpenChange')(false));
    expect(latestViewProps()).toMatchObject({
      offlineTallyDialogOpen: false,
      offlineTallyPasswordError: null,
      offlineTallySubmitError: null,
    });

    act(() => viewProp<(target: string) => void>('setNamedResultsTarget')('election'));
    expect(viewProp<ViewRow>('namedResultsDialogConfig').title).toBe(
      'features.events.agenda.namedResults.electionFallbackTitle'
    );
  });

  it('saves offline vote tallies and separates password, cap and generic failures', async () => {
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => true),
      canVote: vi.fn(() => true),
      canBeCandidate: vi.fn(() => false),
    });
    const rosterEvent = {
      id: 'event-1',
      attendance_mode: 'hybrid',
      participants: [],
      offline_participants: [
        {
          id: 'offline-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ],
    };
    mocks.useEventById.mockImplementation((reference?: string) => ({
      event: reference === 'event-1' ? rosterEvent : null,
    }));
    const choices = [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ];
    const vote = {
      id: 'vote-1',
      title: null,
      status: 'final',
      electorate_snapshotted_at: 1,
      offline_electorate_size: 1,
      choices,
      voters: [
        { id: 'voter-1', user_id: 'user-1', participation_channel: 'online' },
        { id: 'voter-offline', user_id: 'user-2', participation_channel: 'offline' },
      ],
      indicative_decisions: [{ id: 'indicative-decision' }],
      final_decisions: [{ id: 'final-decision' }],
      indicative_participations: [],
      final_participations: [
        {
          voter_id: 'voter-1',
          decisions: [{ choice: { id: 'yes' } }, { choice_id: 'no' }, { choice_id: null }],
        },
      ],
      offline_tallies: [{ phase: 'final', choice_id: 'yes', count: 1 }],
    };
    mocks.useEventAgendaItem.mockReturnValue({
      agendaItem: {
        id: 'agenda-vote',
        event_id: 'event-1',
        title: null,
        type: 'vote',
        status: 'in-progress',
        voting_phase: 'final',
        amendment_id: null,
        amendment: null,
        speaker_list: [],
        order_index: 1,
      },
      event: { id: 'event-1', title: null, status: 'active' },
      user: { id: 'user-1' },
      isLoading: false,
      votingLoading: null,
      addingSpeaker: false,
      election: null,
      candidates: [],
      vote,
      votesByAgendaItem: [vote],
      choices,
      userElector: null,
      userVoter: { id: 'voter-1' },
      estimatedStartTime: null,
      forwardingContext: createForwardingContext(),
      handleDelete: vi.fn(),
      handleAddToSpeakerList: vi.fn(),
      canJoinSpeakerList: false,
    });

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-vote" />);
    expect(latestViewProps()).toMatchObject({
      eligibleFinalVoterCount: 2,
      indicativeDecisions: [{ id: 'indicative-decision' }],
      finalDecisions: [{ id: 'final-decision' }],
      userHasVoteVoted: true,
      userSelectedChoiceIds: ['yes', 'no'],
      offlineTallyPhase: 'final',
      showOfflineTallyButton: true,
    });
    const submit = viewProp<
      (input: { password: string; counts: Record<string, number> }) => Promise<void>
    >('handleSubmitOfflineTally');
    await act(async () => submit({ password: '1234', counts: { yes: 2, no: 0 } }));
    expect(mocks.upsertVoteOfflineTally).toHaveBeenCalledTimes(2);

    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('Invalid voting password.'));
    await act(async () => submit({ password: 'bad', counts: {} }));
    expect(viewProp<string>('offlineTallyPasswordError')).toBe('Invalid voting password.');
    expect(mocks.toastError).not.toHaveBeenCalled();

    mocks.verifyVotingPassword.mockRejectedValueOnce(
      new Error('Offline vote totals cannot exceed the current cap')
    );
    await act(async () => submit({ password: '1234', counts: {} }));
    const toastOptions = mocks.toastError.mock.calls.at(-1)?.[1] as {
      action?: { onClick?: () => void };
    };
    toastOptions.action?.onClick?.();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/event/$id/participants',
      params: { id: 'event-1' },
    });

    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('Database unavailable'));
    await act(async () => submit({ password: '1234', counts: {} }));
    expect(viewProp<string>('offlineTallySubmitError')).toBe('Database unavailable');
    mocks.verifyVotingPassword.mockRejectedValueOnce('unknown failure');
    await act(async () => submit({ password: '1234', counts: {} }));
    expect(mocks.toastError).toHaveBeenCalledTimes(3);

    act(() => viewProp<(target: string) => void>('setNamedResultsTarget')('vote'));
    expect(viewProp<ViewRow>('namedResultsDialogConfig').title).toBe(
      'features.events.agenda.namedResults.voteFallbackTitle'
    );
  });

  it('maps branch discussions, pending submissions and snapshot/document diffs', () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    const processRun = amendment.current_process_run as ViewRow;
    const branch = (processRun.branches as ViewRow[])[0];
    branch.change_requests = [
      {
        id: 'cr-snapshot',
        title: 'CR-SNAPSHOT',
        process_branch_id: 'branch-1',
        status: 'open',
        voting_status: null,
        confirmation_status: null,
        branch_sequence_number: 1,
        created_at: 10,
      },
      {
        id: 'cr-pending',
        title: 'CR-PENDING',
        process_branch_id: 'branch-1',
        status: 'pending_submission',
        voting_status: 'pending_submission',
        confirmation_status: 'pending',
        branch_sequence_number: null,
        created_at: null,
      },
      { id: 'cr-empty', process_branch_id: 'branch-1', status: null },
    ];
    branch.discussions = [
      {
        id: 'discussion-snapshot',
        changeRequestEntityId: 'cr-snapshot',
        crId: 'CR-SNAPSHOT',
        displayCrId: 'Legacy display',
        branchSequenceNumber: 9,
        title: 'Snapshot discussion',
        userId: 'user-2',
        comments: [{ id: 'comment-1' }],
        createdAt: 20,
        isResolved: true,
        confirmationStatus: 'confirmed',
        changeRequestStatus: 'legacy',
      },
      {
        id: 'doc-render',
        crId: 'CR-PENDING',
        title: 'Pending discussion',
        confirmationStatus: 'confirmed',
      },
      {
        id: 'discussion-unmatched',
        crId: 'UNKNOWN',
        displayCrId: 'Own display',
        branchSequenceNumber: 4,
        title: 'Unmatched',
        userId: 'user-3',
        comments: [],
        createdAt: 30,
        isResolved: false,
        confirmationStatus: 'rejected',
        changeRequestStatus: 'open',
      },
      { id: 'doc-empty', title: 'Empty document suggestion' },
      {},
    ];
    mocks.suggestionContentFromChangeRequestSnapshot.mockImplementation((request: ViewRow) => {
      if (request.id === 'cr-snapshot') {
        return {
          type: 'replace',
          text: 'old',
          newText: '',
          properties: { color: 'red' },
          newProperties: undefined,
        };
      }
      if (request.id === 'cr-pending') {
        return {
          type: 'insert',
          text: '',
          newText: 'new',
          properties: undefined,
          newProperties: { color: 'blue' },
        };
      }
      return null;
    });
    mocks.extractSuggestionContent.mockImplementation((discussionId: string) => {
      if (discussionId === 'doc-render') {
        return {
          type: 'delete',
          text: 'removed',
          newText: '',
          properties: null,
          newProperties: null,
        };
      }
      if (discussionId === 'doc-empty') {
        return {
          type: 'insert',
          text: '',
          newText: 'added',
          properties: null,
          newProperties: null,
        };
      }
      return null;
    });
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
    });
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [
        {
          id: 'timeline-existing',
          process_branch_id: 'branch-1',
          change_request_id: 'other-cr',
          order_index: 'unknown',
          status: 'completed',
          vote_id: null,
        },
        {
          id: 'timeline-ordered',
          process_branch_id: 'branch-1',
          change_request_id: 'ordered-cr',
          order_index: 4,
          status: 'completed',
          vote_id: null,
        },
      ],
    });

    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    const discussions = viewProp<ViewRow[]>('amendmentDiscussions');
    expect(discussions).toHaveLength(5);
    expect(discussions[1]).toMatchObject({
      confirmationStatus: 'pending',
      changeRequestStatus: 'pending_submission',
    });
    expect(discussions[4]).toMatchObject({
      id: '',
      crId: null,
      title: '',
      userId: '',
      comments: [],
      isResolved: false,
    });
    expect(viewProp<ViewRow>('crDiffMap')).toMatchObject({
      'cr-snapshot': { changeType: 'replace', originalText: 'old' },
      'cr-pending': { changeType: 'insert', newText: 'new' },
      'doc-render': { changeType: 'delete', originalText: 'removed' },
    });
    expect(viewProp<ViewRow[]>('mockCRItems').length).toBeGreaterThan(0);

    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [],
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
  });

  it('uses amendment-level unscoped data and blocks suggestion vote materialization without rights', () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    (amendment.current_process_run as ViewRow).branches = [];
    amendment.editing_mode = 'suggest_event';
    amendment.change_requests = [
      {
        id: 'main-cr',
        title: null,
        process_branch_id: null,
        status: null,
        voting_status: null,
        confirmation_status: null,
      },
      { id: 'other-cr', process_branch_id: 'other-branch' },
      { process_branch_id: null },
    ];
    amendment.discussions = 'not-an-array';
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      user: { id: 'user-1' },
    });
    mocks.useUserState.mockReturnValue({
      user: {
        id: 'user-1',
        first_name: null,
        last_name: null,
        email: null,
        avatar: null,
        gender: null,
      },
    });
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => false),
      canVote: vi.fn(() => false),
      canBeCandidate: vi.fn(() => false),
    });

    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    expect(viewProp<ViewRow>('userRecord')).toMatchObject({
      id: 'user-1',
      name: undefined,
      email: undefined,
      avatar: undefined,
      gender: null,
    });
    expect(viewProp<ViewRow[]>('amendmentDiscussions')).toEqual([]);
    expect(mocks.ensureEventSuggestionChangeRequestVotes).not.toHaveBeenCalled();
  });

  it('materializes amendment-level suggestion votes with a null branch and tolerates a missing relation', async () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    (amendment.current_process_run as ViewRow).branches = [];
    amendment.editing_mode = 'suggest_event';
    amendment.change_requests = [{ id: 'main-cr', process_branch_id: null, status: 'open' }];
    amendment.discussions = [];
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      user: { id: 'user-1' },
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    await waitFor(() =>
      expect(mocks.ensureEventSuggestionChangeRequestVotes).toHaveBeenCalledWith({
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: null,
      })
    );

    const withoutAmendment = { ...agendaItem, amendment: null };
    mocks.useEventAgendaItem.mockReturnValue({
      ...(mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow),
      agendaItem: withoutAmendment,
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('mockCRItems')).toEqual([]);
  });

  it('falls back to amendment change requests when a selected branch relation is unavailable', () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    const branch = ((amendment.current_process_run as ViewRow).branches as ViewRow[])[0];
    branch.change_requests = null;
    amendment.change_requests = [
      { id: 'branch-cr', process_branch_id: 'branch-1', status: 'open' },
      { id: 'other-cr', process_branch_id: 'other-branch', status: 'open' },
    ];
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
    });
    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('branchSelectorBranches')).toHaveLength(1);
    act(() => viewProp<(id: string) => void>('onBranchChange')('branch-1'));
  });

  it('synthesizes a closing-only vote and recognizes nested timeline vote identity', () => {
    const closingVote = {
      id: 'closing-only',
      purpose: 'closing',
      status: 'indicative',
      visibility: 'public',
      created_at: 1,
      updated_at: 1,
      choices: [],
    };
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    (amendment.current_process_run as ViewRow).branches = [];
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      vote: closingVote,
      votesByAgendaItem: [],
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('crDisplayItems')[0]._voteStepKind).toBe('closing');
    expect(viewProp<boolean>('isVoteInCRList')).toBe(true);

    const nestedVoteItem = {
      id: 'timeline-nested',
      agenda_item_id: 'agenda-1',
      process_branch_id: null,
      is_closing_vote: true,
      status: 'voting',
      vote_id: 'different-id',
      vote: closingVote,
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [nestedVoteItem],
      currentItem: nestedVoteItem,
    });
    mocks.useEventAgendaItem.mockReturnValue({
      ...(mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow),
      vote: closingVote,
      votesByAgendaItem: [],
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<boolean>('isVoteInCRList')).toBe(true);
  });

  it('redirects final-vote starts to the first startable item and exposes jump navigation', async () => {
    const firstItem = {
      id: 'first-vote',
      agenda_item_id: 'agenda-1',
      process_branch_id: 'branch-1',
      is_closing_vote: false,
      order_index: 0,
      status: 'pending',
      vote: { id: 'vote-first', status: 'indicative', choices: [] },
    };
    const laterItem = {
      ...firstItem,
      id: 'later-vote',
      order_index: 1,
      vote: { id: 'vote-later', status: 'indicative', choices: [] },
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [firstItem, laterItem],
      currentItem: laterItem,
    });
    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    act(() => viewProp<(id: string) => void>('setSelectedCRToolbarItemId')('later-vote'));
    expect(viewProp<ViewRow>('nextStartableSequenceItem').id).toBe('first-vote');
    act(() => viewProp<() => void>('handleJumpToNextStartableSequenceItem')());
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('first-vote');
    await act(async () =>
      viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('later-vote')
    );
    expect(viewProp<ViewRow>('selectedCRToolbarItem').id).toBe('first-vote');

    const closedItem = {
      ...firstItem,
      id: 'closed-vote',
      status: 'completed',
      vote: { id: 'vote-closed', status: 'closed', choices: [] },
      _voteStepKind: 'change_request',
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [closedItem],
      currentItem: closedItem,
    });
    const previousHookResult = mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({ ...previousHookResult, user: null });
    cleanup();
    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    await viewProp<(id: string) => Promise<void>>('handleStartSequenceFinalVote')('closed-vote');
    viewProp<() => void>('handleToolbarCloseVote')();
    await act(async () => Promise.resolve());
  });

  it('builds merge candidates, path activity and event-request states across all fallbacks', () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    const amendment = agendaItem.amendment as ViewRow;
    amendment.document = { content: ['agenda-document'] };
    const forwardingContext = {
      agendaStepRuns: [
        {
          id: 'merge-doc',
          step_kind: 'merge_vote',
          branch_id: 'branch-doc',
          branch: {
            id: 'branch-doc',
            created_at: 2,
            title: null,
            document_version: { content: ['branch-document'] },
          },
          target_group: { name: 'Target' },
        },
        {
          id: 'merge-process',
          step_kind: 'group_vote',
          branch_id: null,
          branch: { id: 'branch-process', created_at: null, title: 'Branch title' },
          target_group: null,
          process_run: { amendment: { document: { content: ['process-document'] } } },
        },
        {
          id: 'merge-agenda',
          step_kind: 'group_vote',
          branch_id: null,
          branch: null,
          target_group: null,
          process_run: null,
        },
      ],
      branchStepRuns: [
        { id: 'no-tasks', event_id: null },
        {
          id: 'wrong-task',
          event_id: null,
          tasks: [{ task_type: 'other', status: 'open' }],
        },
        {
          id: 'closed-task',
          event_id: null,
          tasks: [{ task_type: 'schedule_event', status: 'closed' }],
        },
        {
          id: 'pending-task',
          event_id: null,
          tasks: [{ task_type: 'schedule_event', status: 'open' }],
        },
        {
          id: 'scheduled-task',
          event_id: 'event-2',
          tasks: [{ task_type: 'schedule_event', status: 'open' }],
        },
      ],
      currentStepRun: { branch_id: 'current-branch', branch: { id: 'current-object-branch' } },
      nextStepRun: { id: 'next-step' },
      processRun: { active_branch_id: 'process-branch' },
      processRunStepRuns: [],
    };
    mocks.derivedActiveStep = { id: 'derived-step', branch_id: 'derived-branch' };
    mocks.firstUnresolvedStepId = 'fallback-step';
    mocks.forwardingPreview = { label: 'Forward' };
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      forwardingContext,
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);

    expect(viewProp<ViewRow[]>('mergeVariantCandidates')).toMatchObject([
      { id: 'merge-process', groupName: 'Branch title', content: ['process-document'] },
      { id: 'merge-agenda', groupName: null, content: ['agenda-document'] },
      { id: 'branch-doc', groupName: 'Target', content: ['branch-document'] },
    ]);
    expect(viewProp<string>('detailResolvedActiveBranchId')).toBe('derived-branch');
    expect(viewProp<string>('detailFirstUnresolvedStepId')).toBe('derived-step');
    expect(viewProp<ViewRow>('detailPathVisualizationData').pendingStates).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(viewProp<ViewRow>('agendaForwardingPreview')).toEqual({ label: 'Forward' });
    expect(viewProp<unknown>('voteDialogForwardingPreview')).toBeNull();

    mocks.derivedActiveStep = null;
    const previousHookResult = mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({
      ...previousHookResult,
      agendaItem: {
        ...agendaItem,
        amendment: { ...amendment, document: null },
      },
      forwardingContext: {
        ...forwardingContext,
        agendaStepRuns: [
          {
            id: 'merge-empty',
            step_kind: 'merge_vote',
            branch_id: null,
            branch: null,
            target_group: null,
            process_run: null,
          },
        ],
        processRun: { active_branch_id: 'process-branch' },
        processRunStepRuns: [{ id: 'refresh-derived-step' }],
      },
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('mergeVariantCandidates')[0]).toMatchObject({
      id: 'merge-empty',
      groupName: null,
      content: null,
    });
    expect(viewProp<string>('detailResolvedActiveBranchId')).toBe('process-branch');
    expect(viewProp<string>('detailFirstUnresolvedStepId')).toBe('fallback-step');
  });

  it('covers speaker guard, fallback mapping, no-successor and failure behavior', async () => {
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    agendaItem.speaker_list = [
      {
        id: 'speaker-empty',
        order_index: 0,
        time: 0,
        completed: false,
        title: null,
        start_time: null,
        end_time: null,
        user: {
          id: 'user-empty',
          first_name: null,
          last_name: null,
          email: null,
          avatar: null,
          gender: null,
        },
      },
    ];
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      user: null,
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<ViewRow[]>('speakerListData')[0]).toMatchObject({
      order: 0,
      time: 3,
      completed: false,
      title: undefined,
      startTime: undefined,
      endTime: undefined,
      user: {
        name: undefined,
        email: undefined,
        avatar: undefined,
        gender: null,
      },
    });
    await viewProp<(id: string) => Promise<void>>('handleMarkSpeakerCompleted')('speaker-empty');
    expect(mocks.updateSpeaker).not.toHaveBeenCalled();

    const previousHookResult = mocks.useEventAgendaItem.mock.results.at(-1)?.value as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({ ...previousHookResult, user: { id: 'user-1' } });
    mocks.usePermissions.mockReturnValue({
      can: vi.fn(() => true),
      canVote: vi.fn(() => true),
      canBeCandidate: vi.fn(() => false),
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    await viewProp<(id: string) => Promise<void>>('handleMarkSpeakerCompleted')('speaker-empty');
    expect(mocks.updateSpeaker).toHaveBeenCalledOnce();

    mocks.updateSpeaker.mockRejectedValueOnce(new Error('speaker failed'));
    await viewProp<(id: string) => Promise<void>>('handleMarkSpeakerCompleted')('speaker-empty');
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('renders city-design vote previews with each supported identity fallback', () => {
    const makeStreetItem = (changeRequestId: string | null, entityId: string | null) => ({
      id: 'street-item',
      agenda_item_id: 'agenda-1',
      process_branch_id: 'branch-1',
      change_request_id: entityId,
      is_closing_vote: false,
      status: 'pending',
      change_request: {
        id: changeRequestId,
        source_type: 'city_design_object',
        title: 'Move street object',
        process_branch_id: 'branch-1',
      },
      vote: { id: 'street-vote', status: 'indicative', choices: [] },
    });
    const firstItem = makeStreetItem('street-cr', 'street-entity');
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    agendaItem.title = null;
    (agendaItem.amendment as ViewRow).title = null;
    mocks.cityDesigns = [{ id: 'design-1' }];
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
    });
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [firstItem],
      currentItem: firstItem,
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<unknown>('voteDialogDocumentPreviewContent')).not.toBeNull();

    const entityFallback = makeStreetItem(null, 'street-entity');
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [entityFallback],
      currentItem: entityFallback,
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<unknown>('voteDialogDocumentPreviewContent')).not.toBeNull();

    const itemFallback = makeStreetItem(null, null);
    mocks.useAgendaItemCRVoting.mockReturnValue({
      ...mocks.useAgendaItemCRVoting(),
      crTimeline: [itemFallback],
      currentItem: itemFallback,
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(viewProp<unknown>('voteDialogDocumentPreviewContent')).not.toBeNull();
  });

  it('uses current agenda navigation indexes and starts existing items through the controller', async () => {
    const activateAgendaItem = vi.fn().mockResolvedValue(undefined);
    mocks.useAgendaNavigation.mockReturnValue({
      ...mocks.useAgendaNavigation(),
      currentAgendaItem: { id: 'agenda-1' },
      currentIndex: 3,
      activateAgendaItem,
    });
    const agendaItem = createAgendaItem('suggesting') as ViewRow;
    agendaItem.title = null;
    (agendaItem.amendment as ViewRow).title = null;
    mocks.useEventAgendaItem.mockReturnValue({
      ...mocks.useEventAgendaItem(),
      agendaItem,
      event: { id: 'event-1', title: null, current_agenda_item_id: null },
    });
    render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      toolbarAgendaItemIndex: 3,
      toolbarAgendaItemTopNumber: 4,
    });
    await viewProp<() => Promise<void>>('handleToolbarStartItem')();
    expect(activateAgendaItem).toHaveBeenCalledWith('agenda-1');
  });

  it('derives final missing-actor and indicative recorded ballot states', () => {
    const finalElection = {
      id: 'election-final',
      status: 'final',
      candidates: [],
      electors: [],
    };
    const finalVote = {
      id: 'vote-final',
      status: 'final',
      choices: [],
      voters: [],
    };
    const defaultHookResult = mocks.useEventAgendaItem() as ViewRow;
    mocks.useEventAgendaItem.mockReturnValue({
      ...defaultHookResult,
      election: finalElection,
      vote: finalVote,
      votesByAgendaItem: [finalVote],
      userElector: null,
      userVoter: null,
    });
    const rendered = render(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      userHasElectionVoted: false,
      userSelectedCandidateIds: [],
      userHasVoteVoted: false,
      userSelectedChoiceIds: [],
    });

    const missingArrayElection = {
      id: 'election-missing-arrays',
      status: 'final',
      candidates: [],
    };
    const missingArrayVote = {
      id: 'vote-missing-arrays',
      status: 'final',
      choices: [],
      electorate_snapshotted_at: 1,
    };
    mocks.useEventAgendaItem.mockReturnValue({
      ...defaultHookResult,
      election: missingArrayElection,
      vote: missingArrayVote,
      votesByAgendaItem: [missingArrayVote],
      userElector: { id: 'elector-missing' },
      userVoter: { id: 'voter-missing' },
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      eligibleFinalVoterCount: 0,
      userHasElectionVoted: false,
      userSelectedCandidateIds: [],
      userHasVoteVoted: false,
      userSelectedChoiceIds: [],
    });

    const actorWithoutSelectionsElection = {
      ...missingArrayElection,
      final_participations: [{ elector_id: 'elector-missing' }],
    };
    const actorWithoutSelectionsVote = {
      ...missingArrayVote,
      final_participations: [{ voter_id: 'voter-missing' }],
    };
    mocks.useEventAgendaItem.mockReturnValue({
      ...defaultHookResult,
      election: actorWithoutSelectionsElection,
      vote: actorWithoutSelectionsVote,
      votesByAgendaItem: [actorWithoutSelectionsVote],
      userElector: { id: 'elector-missing' },
      userVoter: { id: 'voter-missing' },
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      userHasElectionVoted: true,
      userSelectedCandidateIds: [],
      userHasVoteVoted: true,
      userSelectedChoiceIds: [],
    });

    const indicativeElection = {
      id: 'election-indicative',
      status: 'indicative',
      candidates: [],
      indicative_participations: [
        {
          user_id: 'user-1',
          selections: [{ candidate: { id: 'candidate-object' } }, { candidate_id: 'candidate-id' }],
        },
      ],
    };
    const indicativeVote = {
      id: 'vote-indicative',
      status: 'indicative',
      choices: [],
      voters: [],
      indicative_participations: [
        {
          user_id: 'user-1',
          decisions: [{ choice: { id: 'choice-object' } }, { choice_id: 'choice-id' }],
        },
      ],
    };
    mocks.useEventAgendaItem.mockReturnValue({
      ...defaultHookResult,
      election: indicativeElection,
      vote: indicativeVote,
      votesByAgendaItem: [indicativeVote],
      userElector: null,
      userVoter: null,
    });
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      userHasElectionVoted: true,
      userSelectedCandidateIds: ['candidate-object', 'candidate-id'],
      userHasVoteVoted: true,
      userSelectedChoiceIds: ['choice-object', 'choice-id'],
    });

    mocks.useEventAgendaItem.mockReturnValue({
      ...defaultHookResult,
      election: { ...indicativeElection, indicative_participations: [{ user_id: 'other-user' }] },
      vote: { ...indicativeVote, indicative_participations: [{ user_id: 'other-user' }] },
      votesByAgendaItem: [],
    });
    mocks.useEventParticipantsByParticipatedEventIds.mockReturnValue({ participants: [] });
    mocks.useEventById.mockReturnValue({
      event: { participants: [{ id: 'fallback', status: null }], offline_participants: [] },
    });
    mocks.delegateComposition = {
      isDelegateAssembly: true,
      participantsWithProvenance: [{ id: 'delegate-participant' }],
    };
    rendered.rerender(<EventAgendaItemDetail eventId="event-1" agendaItemId="agenda-1" />);
    expect(latestViewProps()).toMatchObject({
      eligibleParticipantsForNamedResults: [{ id: 'delegate-participant' }],
      userSelectedCandidateIds: [],
      userSelectedChoiceIds: [],
    });
  });
});
