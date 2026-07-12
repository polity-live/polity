/* @vitest-environment jsdom */

import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  closeExpiredFinalVotesForEvent: vi.fn(),
  ensureEventSuggestionChangeRequestVotes: vi.fn(),
  initializeChangeRequestVoting: vi.fn(),
  updateAgendaVote: vi.fn(),
  updateSpeaker: vi.fn(),
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

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
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
    upsertOfflineTally: vi.fn(),
    closeExpiredFinalVotesForEvent: mocks.closeExpiredFinalVotesForEvent,
  }),
}));

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    upsertOfflineTally: vi.fn(),
  }),
}));

vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({
    verifyVotingPassword: vi.fn(),
  }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: (...args: unknown[]) => mocks.useUserState(...args),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ streetDesigns: [] }),
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
  useDelegateAssemblyParticipantsComposition: () => ({
    isDelegateAssembly: false,
    participantsWithProvenance: [],
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../EventAgendaItemDetailView', () => ({
  EventAgendaItemDetailView: () => null,
}));

import { EventAgendaItemDetail } from '../EventAgendaItemDetail';

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
  });
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  setDefaultMocks();
});

afterEach(() => {
  cleanup();
});

describe('EventAgendaItemDetail event-suggestion CR votes', () => {
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
});
