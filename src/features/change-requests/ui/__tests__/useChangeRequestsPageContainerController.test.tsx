/* @vitest-environment jsdom */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  finalizeExpiredInternalChangeRequestVotes: vi.fn(),
  finalizeInternalChangeRequestVote: vi.fn(),
  useAmendmentState: vi.fn(),
  useChangeRequests: vi.fn(),
  useAgendaItemByAmendment: vi.fn(),
  useAgendaItemCRVoting: vi.fn(),
  ensureEventSuggestionChangeRequestVotes: vi.fn(),
  castCRVote: vi.fn(),
  hasUserVoted: vi.fn(),
  getUserSelectedChoiceIds: vi.fn(),
  verifyVotingPassword: vi.fn(),
  usePermissions: vi.fn(),
  voteOnChangeRequest: vi.fn(),
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaItemByAmendment: (...args: unknown[]) => mocks.useAgendaItemByAmendment(...args),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    ensureEventSuggestionChangeRequestVotes: mocks.ensureEventSuggestionChangeRequestVotes,
  }),
}));

vi.mock('@/features/agendas/hooks/useAgendaItemCRVoting', () => ({
  getVotePhase: (item: any) =>
    item?.vote?.status === 'final'
      ? 'final'
      : item?.vote?.status === 'closed'
        ? 'closed'
        : 'indicative',
  useAgendaItemCRVoting: (...args: unknown[]) => mocks.useAgendaItemCRVoting(...args),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    finalizeExpiredInternalChangeRequestVotes: mocks.finalizeExpiredInternalChangeRequestVotes,
    finalizeInternalChangeRequestVote: mocks.finalizeInternalChangeRequestVote,
    voteOnChangeRequest: mocks.voteOnChangeRequest,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (...args: unknown[]) => mocks.useAmendmentState(...args),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: (...args: unknown[]) => mocks.usePermissions(...args),
}));

vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({
    verifyVotingPassword: mocks.verifyVotingPassword,
  }),
}));

vi.mock('../../hooks/useChangeRequests', () => ({
  useChangeRequests: (...args: unknown[]) => mocks.useChangeRequests(...args),
}));

import { useChangeRequestsPageContainerController } from '../useChangeRequestsPageContainerController';

function setDefaultHookData() {
  mocks.useAgendaItemByAmendment.mockReturnValue({ agendaItem: null, agendaItemId: null });
  mocks.useAgendaItemCRVoting.mockReturnValue({
    crTimeline: [],
    hasUserVoted: mocks.hasUserVoted,
    getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
    castCRVote: mocks.castCRVote,
  });
  mocks.useAmendmentState.mockReturnValue({ amendmentProcess: null });
  mocks.useChangeRequests.mockReturnValue({
    amendment: {
      id: 'amendment-1',
      internal_cr_voting_close_trigger: null,
    },
    document: null,
    openChangeRequests: [],
    approvedChangeRequests: [],
    declinedChangeRequests: [],
    isLoading: false,
  });
}

describe('useChangeRequestsPageContainerController permissions', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    setDefaultHookData();
  });

  afterEach(() => {
    cleanup();
  });

  it('bases internal vote management on amendment manage permission', () => {
    const permissions = {
      can: vi.fn().mockReturnValue(true),
      canManage: vi.fn().mockReturnValue(true),
      canVote: vi.fn().mockReturnValue(false),
      canUpdate: vi.fn().mockReturnValue(false),
    };
    mocks.usePermissions.mockReturnValue(permissions);

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
      })
    );

    expect(result.current.canManageInternalVotes).toBe(true);
    expect(permissions.canManage).toHaveBeenCalledWith('amendments');
    expect(permissions.canUpdate).not.toHaveBeenCalledWith('amendments');
  });

  it('does not allow update-only amendment rights to manage internal votes', () => {
    const permissions = {
      can: vi.fn().mockReturnValue(true),
      canManage: vi.fn().mockReturnValue(false),
      canVote: vi.fn().mockReturnValue(false),
      canUpdate: vi.fn().mockReturnValue(true),
    };
    mocks.usePermissions.mockReturnValue(permissions);

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
      })
    );

    expect(result.current.canManageInternalVotes).toBe(false);
    expect(permissions.canManage).toHaveBeenCalledWith('amendments');
    expect(permissions.canUpdate).not.toHaveBeenCalledWith('amendments');
  });

  it('prefers real event vote timeline rows for the selected branch', async () => {
    const permissions = {
      can: vi.fn().mockReturnValue(false),
      canManage: vi.fn().mockReturnValue(false),
      canVote: vi.fn().mockReturnValue(true),
      canUpdate: vi.fn().mockReturnValue(false),
    };
    const branchOneRow = {
      id: 'agenda-cr-branch-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-branch-1',
      process_branch_id: 'branch-1',
      status: 'pending',
      is_closing_vote: false,
      change_request: { id: 'cr-branch-1', title: 'Branch 1 CR' },
      vote: {
        id: 'vote-branch-1',
        status: 'indicative',
        choices: [{ id: 'choice-yes-1', label: 'yes' }],
      },
    };
    const branchTwoRow = {
      id: 'agenda-cr-branch-2',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-branch-2',
      process_branch_id: 'branch-2',
      status: 'pending',
      is_closing_vote: false,
      change_request: { id: 'cr-branch-2', title: 'Branch 2 CR' },
      vote: {
        id: 'vote-branch-2',
        status: 'indicative',
        choices: [{ id: 'choice-yes-2', label: 'yes' }],
      },
    };

    mocks.usePermissions.mockReturnValue(permissions);
    mocks.useAgendaItemByAmendment.mockReturnValue({
      agendaItem: { id: 'agenda-1', event_id: 'event-1', amendment_id: 'amendment-1' },
      agendaItemId: 'agenda-1',
    });
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [branchOneRow, branchTwoRow],
      hasUserVoted: mocks.hasUserVoted,
      getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
      castCRVote: mocks.castCRVote,
    });
    mocks.useAmendmentState.mockReturnValue({
      amendmentProcess: {
        current_process_run: {
          active_branch_id: 'branch-1',
          branches: [
            { id: 'branch-1', editing_mode: 'suggest_event', created_at: 1 },
            { id: 'branch-2', editing_mode: 'suggest_event', created_at: 2 },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        userId: 'user-1',
        requestedBranchId: 'branch-1',
      })
    );

    expect(result.current.timelineItems).toEqual([branchOneRow]);
    expect(
      result.current.branchSections.find(section => section.branchId === 'branch-1')?.timelineItems
    ).toEqual([branchOneRow]);
    expect(
      result.current.branchSections.find(section => section.branchId === 'branch-2')?.timelineItems
    ).toEqual([branchTwoRow]);

    await waitFor(() =>
      expect(mocks.ensureEventSuggestionChangeRequestVotes).toHaveBeenCalledWith({
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: 'branch-1',
      })
    );
    expect(mocks.ensureEventSuggestionChangeRequestVotes).not.toHaveBeenCalledWith(
      expect.objectContaining({ process_branch_id: 'branch-2' })
    );
  });
});
