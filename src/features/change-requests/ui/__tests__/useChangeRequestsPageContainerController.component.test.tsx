/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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
  waitForClientApply: vi.fn(),
  trackServerFinalization: vi.fn(),
  reportAppTutorialAction: vi.fn(),
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

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
  trackServerFinalization: (...args: unknown[]) => mocks.trackServerFinalization(...args),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: (...args: unknown[]) => mocks.reportAppTutorialAction(...args),
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
    obsoleteChangeRequests: [],
    cityDesigns: [],
    isLoading: false,
  });
  mocks.usePermissions.mockReturnValue({
    can: vi.fn().mockReturnValue(false),
    canManage: vi.fn().mockReturnValue(false),
    canVote: vi.fn().mockReturnValue(false),
  });
  mocks.waitForClientApply.mockResolvedValue(undefined);
  mocks.trackServerFinalization.mockImplementation((_result, options) => options.onSuccess());
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
    const obsoleteBranchOneRow = {
      ...branchOneRow,
      id: 'agenda-cr-obsolete-branch-1',
      change_request_id: 'cr-obsolete-branch-1',
      change_request: {
        id: 'cr-obsolete-branch-1',
        title: 'Obsolete Branch 1 CR',
        obsolete_reason: 'suggestion_removed_in_collaborative_editing',
        obsolete_at: 123,
      },
    };

    mocks.usePermissions.mockReturnValue(permissions);
    mocks.useAgendaItemByAmendment.mockReturnValue({
      agendaItem: { id: 'agenda-1', event_id: 'event-1', amendment_id: 'amendment-1' },
      agendaItemId: 'agenda-1',
    });
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [branchOneRow, obsoleteBranchOneRow, branchTwoRow],
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

  it('deduplicates current and historical branches and accepts request-only branch links', async () => {
    mocks.useAgendaItemByAmendment.mockReturnValue({
      agendaItem: { id: 'agenda-1' },
      agendaItemId: 'agenda-1',
    });
    mocks.useAmendmentState.mockReturnValue({
      amendmentProcess: {
        current_process_run: {
          active_branch_id: 'branch-current',
          branches: [
            { id: 'branch-current', editing_mode: 'direct', created_at: 2 },
            { id: 'branch-duplicate', editing_mode: 'vote_internal', created_at: 3 },
          ],
        },
        process_runs: [
          {
            branches: [
              { id: 'branch-old', editing_mode: 'suggest_event', created_at: 1 },
              { id: 'branch-duplicate', editing_mode: 'direct', created_at: 99 },
            ],
          },
          { branches: null },
        ],
      },
    });
    mocks.useChangeRequests.mockReturnValue({
      amendment: { id: 'amendment-1', editing_mode: 'direct' },
      document: { content: [] },
      cityDesigns: [],
      openChangeRequests: [
        {
          id: 'request-only',
          processBranchId: 'removed-branch',
          status: 'open',
          confirmationStatus: null,
          changeRequestStatus: null,
        },
        {
          id: 'main-request',
          processBranchId: null,
          status: 'open',
          confirmationStatus: 'confirmed',
          changeRequestStatus: 'open',
        },
      ],
      approvedChangeRequests: [],
      declinedChangeRequests: [],
      obsoleteChangeRequests: [],
      isLoading: false,
    });

    const { result, rerender } = renderHook(
      (props: { requestedBranchId?: string }) =>
        useChangeRequestsPageContainerController({
          amendmentId: 'amendment-1',
          requestedBranchId: props.requestedBranchId,
        }),
      { initialProps: { requestedBranchId: 'branch-old' as string | undefined } }
    );

    expect(result.current.branchSelectorBranches.map(branch => branch.id)).toEqual([
      'branch-old',
      'branch-current',
      'branch-duplicate',
    ]);
    expect(result.current.selectedBranchId).toBe('branch-old');
    expect(result.current.selectedBranchEditingMode).toBe('suggest_event');

    rerender({ requestedBranchId: 'removed-branch' });
    expect(result.current.selectedBranchId).toBe('removed-branch');
    expect(result.current.selectedBranchEditingMode).toBe('edit');

    rerender({ requestedBranchId: 'missing' });
    expect(result.current.selectedBranchId).toBeNull();

    rerender({ requestedBranchId: undefined });
    await waitFor(() =>
      expect(mocks.ensureEventSuggestionChangeRequestVotes).toHaveBeenCalledWith(
        expect.objectContaining({ process_branch_id: 'branch-old' })
      )
    );
  });

  it('normalizes legacy timeline branch fields and removes every obsolete marker', () => {
    const activeRows = [
      { id: 'direct', process_branch_id: 'branch-1', change_request: {} },
      { id: 'camel', processBranchId: 'branch-1', change_request: {} },
      { id: 'private', _processBranchId: 'branch-1', change_request: {} },
      {
        id: 'change-request-snake',
        change_request: { process_branch_id: 'branch-1' },
      },
      {
        id: 'change-request-camel',
        change_request: { processBranchId: 'branch-1' },
      },
      { id: 'main', change_request: {} },
    ];
    const obsoleteRows = [
      { id: 'status', process_branch_id: 'branch-1', change_request: { status: 'obsolete' } },
      {
        id: 'change-status',
        process_branch_id: 'branch-1',
        change_request: { change_request_status: 'obsolete' },
      },
      {
        id: 'obsolete-at',
        process_branch_id: 'branch-1',
        change_request: { obsolete_at: 1 },
      },
      {
        id: 'obsolete-reason',
        process_branch_id: 'branch-1',
        change_request: { obsolete_reason: 'replaced' },
      },
    ];
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [...activeRows, ...obsoleteRows],
      hasUserVoted: mocks.hasUserVoted,
      getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
      castCRVote: mocks.castCRVote,
    });
    mocks.useAmendmentState.mockReturnValue({
      amendmentProcess: {
        current_process_run: {
          branches: [{ id: 'branch-1', editing_mode: 'suggest_event', created_at: 1 }],
        },
      },
    });

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({
        amendmentId: 'amendment-1',
        requestedBranchId: 'branch-1',
      })
    );

    expect(result.current.timelineItems.map(item => item.id)).toEqual([
      'direct',
      'camel',
      'private',
      'change-request-snake',
      'change-request-camel',
    ]);
  });

  it('initializes main-branch event voting and exposes event permissions', async () => {
    const amendmentPermissions = {
      can: vi.fn().mockReturnValue(false),
      canManage: vi.fn().mockReturnValue(false),
      canVote: vi.fn().mockReturnValue(false),
    };
    const eventPermissions = {
      can: vi.fn(),
      canManage: vi.fn(),
      canVote: vi.fn().mockReturnValue(true),
    };
    mocks.usePermissions
      .mockReturnValueOnce(amendmentPermissions)
      .mockReturnValueOnce(eventPermissions);
    mocks.useAgendaItemByAmendment.mockReturnValue({
      agendaItem: { id: 'agenda-1', event: { id: 'event-nested' } },
      agendaItemId: 'agenda-1',
    });
    mocks.useChangeRequests.mockReturnValue({
      amendment: { id: 'amendment-1', title: 'Amendment', editing_mode: 'suggest_event' },
      document: null,
      cityDesigns: [],
      openChangeRequests: [],
      approvedChangeRequests: [],
      declinedChangeRequests: [],
      obsoleteChangeRequests: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({ amendmentId: 'amendment-1' })
    );

    expect(result.current.isInVotingStage).toBe(true);
    expect(result.current.canManageInternalVotes).toBe(false);
    expect(result.current.canVoteInternal).toBe(false);
    expect(result.current.canVoteEvent).toBe(true);
    expect(mocks.usePermissions).toHaveBeenNthCalledWith(2, { eventId: 'event-nested' });
    await waitFor(() =>
      expect(mocks.ensureEventSuggestionChangeRequestVotes).toHaveBeenCalledWith({
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-1',
        process_branch_id: null,
      })
    );
  });

  it('finalizes expired internal votes immediately and on the polling interval', () => {
    let scheduledFinalize: (() => void) | undefined;
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(handler => {
      scheduledFinalize = handler as () => void;
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    try {
      mocks.useAmendmentState.mockReturnValue({
        amendmentProcess: {
          current_process_run: {
            branches: [
              { id: 'branch-vote', editing_mode: 'vote_internal', created_at: 1 },
              { id: 'branch-direct', editing_mode: 'direct', created_at: 2 },
            ],
          },
        },
      });
      mocks.useChangeRequests.mockReturnValue({
        amendment: {
          id: 'amendment-1',
          internal_cr_voting_close_trigger: 'after_minutes',
        },
        document: null,
        cityDesigns: [],
        openChangeRequests: [],
        approvedChangeRequests: [],
        declinedChangeRequests: [],
        obsoleteChangeRequests: [],
        isLoading: false,
      });

      const { result, unmount } = renderHook(() =>
        useChangeRequestsPageContainerController({
          amendmentId: 'amendment-1',
          requestedBranchId: 'branch-vote',
        })
      );

      expect(result.current.isInVotingStage).toBe(true);
      expect(mocks.finalizeExpiredInternalChangeRequestVotes).toHaveBeenCalledTimes(1);
      expect(mocks.finalizeExpiredInternalChangeRequestVotes).toHaveBeenCalledWith({
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-vote',
      });
      act(() => scheduledFinalize?.());
      expect(mocks.finalizeExpiredInternalChangeRequestVotes).toHaveBeenCalledTimes(2);
      unmount();
      act(() => scheduledFinalize?.());
      expect(mocks.finalizeExpiredInternalChangeRequestVotes).toHaveBeenCalledTimes(2);
      expect(clearIntervalSpy).toHaveBeenCalledWith(1);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('casts internal choices, waits for client apply, and reports successful voting', async () => {
    const mutationResult = { client: Promise.resolve(), server: Promise.resolve() };
    mocks.voteOnChangeRequest.mockReturnValue(mutationResult);
    const randomUuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-4000-8000-000000000001');
    const { result } = renderHook(() =>
      useChangeRequestsPageContainerController({ amendmentId: 'amendment-1' })
    );

    await act(async () => {
      await result.current.onCastInternalVote({}, 'choice-yes-1');
      await result.current.onCastInternalVote({ id: 'cr-1' }, 'choice-yes-1');
      await result.current.onCastInternalVote(
        { change_request_id: 'cr-2', id: 'ignored' },
        'choice-no-1'
      );
      await result.current.onCastInternalVote({ id: 'cr-3' }, 'choice-abstain-1');
      await result.current.onFinalizeInternalVote('cr-final');
    });

    expect(mocks.voteOnChangeRequest.mock.calls.map(call => call[0])).toEqual([
      { id: '00000000-0000-4000-8000-000000000001', change_request_id: 'cr-1', vote: 'accept' },
      { id: '00000000-0000-4000-8000-000000000001', change_request_id: 'cr-2', vote: 'reject' },
      { id: '00000000-0000-4000-8000-000000000001', change_request_id: 'cr-3', vote: 'abstain' },
    ]);
    expect(mocks.waitForClientApply).toHaveBeenCalledTimes(3);
    expect(mocks.trackServerFinalization).toHaveBeenCalledTimes(3);
    expect(mocks.reportAppTutorialAction).toHaveBeenCalledTimes(3);
    expect(mocks.finalizeInternalChangeRequestVote).toHaveBeenCalledWith({
      change_request_id: 'cr-final',
    });
    randomUuid.mockRestore();
  });

  it('drives the event dialog, vote callbacks, phases, titles, and password errors', async () => {
    const row = {
      id: 'agenda-cr-1',
      process_branch_id: null,
      status: 'pending',
      change_request: { id: 'cr-1', title: 'CR title' },
      vote: {
        id: 'vote-1',
        status: 'final',
        title: 'Vote title',
        choices: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: '' },
        ],
      },
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [row],
      hasUserVoted: mocks.hasUserVoted,
      getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
      castCRVote: mocks.castCRVote,
    });
    mocks.useChangeRequests.mockReturnValue({
      amendment: { id: 'amendment-1', title: 'Amendment title' },
      document: null,
      cityDesigns: [],
      openChangeRequests: [],
      approvedChangeRequests: [],
      declinedChangeRequests: [],
      obsoleteChangeRequests: [],
      isLoading: false,
    });
    const { result, rerender } = renderHook(
      (props: { tick: number }) => {
        void props.tick;
        return useChangeRequestsPageContainerController({ amendmentId: 'amendment-1' });
      },
      { initialProps: { tick: 0 } }
    );

    expect(result.current.selectedEventVoteTitle).toBe('Amendment title');
    expect(result.current.selectedEventVotePhase).toBe('indication');
    await act(async () => result.current.onCastEventCRVote(row as any, 'yes'));
    expect(mocks.castCRVote).toHaveBeenCalledWith(row, 'yes');
    await act(async () => result.current.onCastEventVoteFromDialog('yes'));
    expect(mocks.castCRVote).toHaveBeenCalledTimes(1);

    act(() => result.current.onOpenEventCRVoteDialog('agenda-cr-1'));
    expect(result.current.eventVoteDialogOpen).toBe(true);
    expect(result.current.selectedEventVoteTitle).toBe('Vote title');
    expect(result.current.selectedEventVoteChoices).toEqual([
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: expect.any(String) },
    ]);
    expect(result.current.selectedEventVotePhase).toBe('final');
    await act(async () =>
      result.current.onCastEventVoteFromDialog('no', { votingPassword: 'pw' } as any)
    );
    expect(mocks.castCRVote).toHaveBeenLastCalledWith(row, 'no', { votingPassword: 'pw' });

    const closedRow = {
      ...row,
      vote: { ...row.vote, status: 'closed', title: '', choices: [] },
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [closedRow],
      hasUserVoted: mocks.hasUserVoted,
      getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
      castCRVote: mocks.castCRVote,
    });
    rerender({ tick: 1 });
    expect(result.current.selectedEventVoteTitle).toBe('CR title');
    expect(result.current.selectedEventVotePhase).toBe('closed');

    const indicativeRow = {
      ...closedRow,
      vote: { ...closedRow.vote, status: 'indicative' },
      change_request: { id: 'cr-1', title: '' },
    };
    mocks.useAgendaItemCRVoting.mockReturnValue({
      crTimeline: [indicativeRow],
      hasUserVoted: mocks.hasUserVoted,
      getUserSelectedChoiceIds: mocks.getUserSelectedChoiceIds,
      castCRVote: mocks.castCRVote,
    });
    rerender({ tick: 2 });
    expect(result.current.selectedEventVoteTitle).toBe('Amendment title');
    expect(result.current.selectedEventVotePhase).toBe('indication');

    mocks.useChangeRequests.mockReturnValue({
      amendment: { id: 'amendment-1' },
      document: null,
      cityDesigns: [],
      openChangeRequests: [],
      approvedChangeRequests: [],
      declinedChangeRequests: [],
      obsoleteChangeRequests: [],
      isLoading: false,
    });
    rerender({ tick: 3 });
    expect(result.current.selectedEventVoteTitle).toBeUndefined();

    mocks.verifyVotingPassword.mockResolvedValueOnce(undefined);
    await act(async () => result.current.onSubmitVotingPassword('correct'));
    expect(result.current.passwordError).toBeNull();
    expect(result.current.isPasswordVerifying).toBe(false);

    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('Wrong password'));
    let passwordFailure: unknown;
    await act(async () => {
      try {
        await result.current.onSubmitVotingPassword('wrong');
      } catch (error) {
        passwordFailure = error;
      }
    });
    expect(passwordFailure).toEqual(new Error('Wrong password'));
    expect(result.current.passwordError).toBe('Wrong password');

    mocks.verifyVotingPassword.mockRejectedValueOnce('network');
    let networkFailure: unknown;
    await act(async () => {
      try {
        await result.current.onSubmitVotingPassword('network');
      } catch (error) {
        networkFailure = error;
      }
    });
    expect(networkFailure).toBe('network');
    expect(result.current.passwordError).toEqual(expect.any(String));
    expect(result.current.isPasswordVerifying).toBe(false);
  });
});
