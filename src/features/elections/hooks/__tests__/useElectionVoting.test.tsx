/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useElectionVoting } from '../useElectionVoting';

const mocks = vi.hoisted(() => ({
  election: null as any,
  isLoading: false,
  can: vi.fn(),
  castFinalVote: vi.fn(),
  updateElection: vi.fn(),
  addCandidate: vi.fn(),
  updateCandidate: vi.fn(),
  createTimelineEvent: vi.fn(),
  createRoleHolderHistory: vi.fn(),
  updateRole: vi.fn(),
  winnerResult: { isTie: false, winner: { id: 'candidate-1', name: 'Ada' }, voteCount: 2 } as any,
  scheduledRevoteDate: null as number | null,
  calculateElectionWinner: vi.fn(),
  computeRoleScheduledRevoteDate: vi.fn(),
  scheduleRoleRevote: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useElectionWithVotes: () => ({ election: mocks.election, isLoading: mocks.isLoading }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    castFinalVote: mocks.castFinalVote,
    updateElection: mocks.updateElection,
    addCandidate: mocks.addCandidate,
    updateCandidate: mocks.updateCandidate,
  }),
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ createTimelineEvent: mocks.createTimelineEvent }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({
    createRoleHolderHistory: mocks.createRoleHolderHistory,
    updateRole: mocks.updateRole,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/utils/voting-utils', () => ({
  calculateElectionWinner: (...args: any[]) => mocks.calculateElectionWinner(...args),
}));
vi.mock('@/features/votes/utils/revote-scheduling', () => ({
  computeRoleScheduledRevoteDate: (...args: any[]) => mocks.computeRoleScheduledRevoteDate(...args),
  scheduleRoleRevote: (...args: any[]) => mocks.scheduleRoleRevote(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

function election(overrides: Record<string, unknown> = {}) {
  return {
    id: 'election-1',
    status: 'voting',
    description: null,
    candidates: [
      { id: 'candidate-1', name: 'Ada', user_id: 'user-1', status: 'accepted' },
      { id: 'candidate-2', name: 'Grace', user_id: 'user-2', status: 'accepted' },
      { id: 'candidate-3', name: 'Declined', user_id: 'user-3', status: 'declined' },
    ],
    electors: [{ id: 'elector-2', user_id: 'user-2' }],
    final_selections: [
      {
        id: 'selection-1',
        candidate_id: 'candidate-1',
        elector_participation_id: 'elector-2',
        candidate: { id: 'candidate-1', name: 'Ada' },
      },
      {
        id: 'selection-2',
        candidate_id: 'candidate-1',
        elector_participation_id: 'elector-3',
        candidate: { id: 'candidate-1', name: 'Ada' },
      },
    ],
    role: {
      id: 'role-1',
      is_recurring: true,
      recurrence_pattern: 'yearly',
      recurrence_interval: 2,
    },
    ...overrides,
  };
}

function renderVoting(userId = 'user-1', groupId: string | undefined = 'group-1') {
  return renderHook(() =>
    useElectionVoting({
      eventId: 'event-1',
      electionId: 'election-1',
      userId,
      groupId,
      groupName: 'Council',
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.election = election();
  mocks.isLoading = false;
  mocks.can.mockReturnValue(true);
  mocks.winnerResult = {
    isTie: false,
    winner: { id: 'candidate-1', name: 'Ada' },
    voteCount: 2,
  };
  mocks.calculateElectionWinner.mockImplementation(() => mocks.winnerResult);
  mocks.scheduledRevoteDate = 3_000_000;
  mocks.computeRoleScheduledRevoteDate.mockImplementation(() => mocks.scheduledRevoteDate);
  mocks.scheduleRoleRevote.mockResolvedValue(4_000_000);
  for (const mutation of [
    mocks.castFinalVote,
    mocks.updateElection,
    mocks.addCandidate,
    mocks.updateCandidate,
    mocks.createTimelineEvent,
    mocks.createRoleHolderHistory,
    mocks.updateRole,
  ])
    mutation.mockResolvedValue(undefined);
});

describe('useElectionVoting', () => {
  it('derives eligibility, participation, counts, leadership, and permission-scoped vote casting', async () => {
    const { result, rerender } = renderVoting();
    expect(result.current).toMatchObject({
      isLoading: false,
      totalVotes: 2,
      voteCounts: { 'candidate-1': 2, 'candidate-2': 0 },
      currentLeader: expect.objectContaining({ id: 'candidate-1' }),
      hasVoted: false,
      isCandidate: true,
      userCandidate: expect.objectContaining({ id: 'candidate-1' }),
      canManage: true,
      canVote: true,
    });
    expect(result.current.eligibleCandidates.map(candidate => candidate.id)).toEqual([
      'candidate-1',
      'candidate-2',
    ]);
    const participationId = await act(async () => result.current.castVote('candidate-2'));
    expect(mocks.castFinalVote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: participationId,
        election_id: 'election-1',
        elector_id: 'user-1',
      }),
      [
        expect.objectContaining({
          candidate_id: 'candidate-2',
          elector_participation_id: participationId,
        }),
      ]
    );

    mocks.election = election({
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      final_selections: [
        {
          id: 'selection-user-1',
          candidate_id: 'candidate-1',
          elector_participation_id: 'elector-1',
          candidate: { id: 'candidate-1', name: 'Ada' },
        },
      ],
    });
    rerender();
    await expect(result.current.castVote('candidate-1')).rejects.toThrow('Already voted');
    await expect(result.current.changeVote()).rejects.toThrow('Changing votes is not supported');
  });

  it('persists tie, no-winner, and completed winner outcomes with timeline attribution', async () => {
    const { result } = renderVoting();
    mocks.winnerResult = { isTie: true, winner: null, voteCount: 2 };
    await expect(result.current.completeElection('simple')).resolves.toMatchObject({
      success: false,
      isTie: true,
    });
    expect(mocks.updateElection).toHaveBeenLastCalledWith({
      id: 'election-1',
      status: 'runoff_required',
    });

    mocks.winnerResult = { isTie: false, winner: null, voteCount: 1 };
    await expect(result.current.completeElection('absolute')).resolves.toMatchObject({
      success: false,
      isTie: false,
    });
    expect(mocks.updateElection).toHaveBeenLastCalledWith({
      id: 'election-1',
      status: 'no_winner',
    });

    mocks.winnerResult = {
      isTie: false,
      winner: { id: 'candidate-1', name: 'Ada' },
      voteCount: 2,
    };
    await expect(result.current.completeElection()).resolves.toMatchObject({
      success: true,
      winner: { id: 'candidate-1', name: 'Ada' },
    });
    expect(mocks.updateElection).toHaveBeenLastCalledWith({
      id: 'election-1',
      status: 'completed',
      description: 'winner:candidate-1',
    });
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'election_completed',
        election_id: 'election-1',
        group_id: 'group-1',
        user_id: 'user-1',
      })
    );
  });

  it('assigns the persisted winner to a role and schedules recurring revotes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    mocks.election = election({ description: 'winner:candidate-1' });
    const { result } = renderVoting();
    const historyId = await act(async () =>
      result.current.assignRoleToWinner('Chair', { termDuration: 'yearly' })
    );
    expect(historyId).toEqual(expect.any(String));
    expect(mocks.createRoleHolderHistory).toHaveBeenCalledWith({
      id: historyId,
      start_date: 2_000_000,
      end_date: null,
      reason: 'elected',
      role_id: 'role-1',
      user_id: 'user-1',
    });
    expect(mocks.updateRole).toHaveBeenCalledWith({
      id: 'role-1',
      term_start_date: 2_000_000,
      scheduled_revote_date: 3_000_000,
    });

    mocks.election = election({ description: null });
    const missing = renderVoting();
    await expect(missing.result.current.assignRoleToWinner('Chair')).rejects.toThrow(
      'No winner or role to assign'
    );
  });

  it('nominates and lets only the owning candidate accept or decline', async () => {
    const { result } = renderVoting();
    const candidateId = await act(async () => result.current.nominateCandidate('user-4'));
    expect(mocks.addCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: candidateId,
        election_id: 'election-1',
        user_id: 'user-4',
        status: 'nominated',
      })
    );
    await act(async () => result.current.acceptNomination('candidate-1'));
    expect(mocks.updateCandidate).toHaveBeenCalledWith({ id: 'candidate-1', status: 'accepted' });
    await act(async () => result.current.declineNomination('candidate-1'));
    expect(mocks.updateCandidate).toHaveBeenLastCalledWith({
      id: 'candidate-1',
      status: 'declined',
    });
    await expect(result.current.acceptNomination('candidate-2')).rejects.toThrow(
      'Cannot accept nomination for another user'
    );

    mocks.can.mockReturnValue(false);
    await expect(result.current.nominateCandidate('user-4')).rejects.toThrow('Permission denied');
  });

  it('handles an absent election, empty candidates, and an elector without a selection', () => {
    mocks.election = null;
    const empty = renderVoting();
    expect(empty.result.current).toMatchObject({
      candidates: [],
      finalSelections: [],
      currentLeader: null,
      userVote: null,
      isCandidate: false,
      userCandidate: undefined,
    });

    mocks.election = election({
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      final_selections: [],
    });
    const noSelection = renderVoting();
    expect(noSelection.result.current.userVote).toBeNull();
  });

  it('enforces voting and completion permissions', async () => {
    mocks.can.mockReturnValue(false);
    const { result } = renderVoting();
    await expect(result.current.castVote('candidate-1')).rejects.toThrow('Permission denied');
    await expect(result.current.completeElection()).rejects.toThrow('Permission denied');
  });

  it('normalizes missing candidate data and timeline attribution fallbacks', async () => {
    mocks.election = election({
      candidates: [
        {
          id: 'candidate-1',
          name: null,
          user: { first_name: 'Ada' },
          user_id: 'user-1',
          status: 'accepted',
        },
        { id: 'candidate-2', name: null, user: null, user_id: 'user-2', status: 'accepted' },
      ],
      final_selections: [
        {
          id: 'selection-1',
          candidate_id: 'candidate-1',
          elector_participation_id: 'e1',
          candidate: null,
        },
      ],
    });
    mocks.winnerResult = { isTie: false, winner: { id: 'candidate-1', name: '' }, voteCount: 1 };
    const { result } = renderVoting('user-1', '');
    await result.current.completeElection('two_thirds');
    expect(mocks.calculateElectionWinner).toHaveBeenCalledWith(
      [{ candidate: { id: '', name: '' } }],
      [
        { id: 'candidate-1', name: 'Ada' },
        { id: 'candidate-2', name: undefined },
      ],
      'two_thirds'
    );
    expect(mocks.createTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: null })
    );
  });

  it('validates every role assignment precondition', async () => {
    mocks.election = election({ description: 'winner:candidate-1', role: null });
    await expect(renderVoting().result.current.assignRoleToWinner('Chair')).rejects.toThrow(
      'No winner or role to assign'
    );

    mocks.election = election({ description: 'winner:candidate-1' });
    await expect(
      renderVoting('user-1', '').result.current.assignRoleToWinner('Chair')
    ).rejects.toThrow('No winner or role to assign');

    mocks.can.mockReturnValue(false);
    await expect(renderVoting().result.current.assignRoleToWinner('Chair')).rejects.toThrow(
      'Permission denied'
    );

    mocks.can.mockReturnValue(true);
    mocks.election = election({
      description: 'winner:missing',
    });
    await expect(renderVoting().result.current.assignRoleToWinner('Chair')).rejects.toThrow(
      'Winner not found'
    );
    mocks.election = election({
      description: 'winner:candidate-1',
      candidates: [{ id: 'candidate-1', name: 'Ada', user_id: null, status: 'accepted' }],
    });
    await expect(renderVoting().result.current.assignRoleToWinner('Chair')).rejects.toThrow(
      'Winner not found'
    );
  });

  it('uses scheduled fallback terms and skips role updates when no recurrence is configured', async () => {
    mocks.computeRoleScheduledRevoteDate.mockReturnValue(null);
    mocks.election = election({
      description: 'winner:candidate-1',
      role: {
        id: 'role-1',
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_interval: null,
      },
    });
    const noSchedule = renderVoting();
    await noSchedule.result.current.assignRoleToWinner('Chair');
    expect(mocks.updateRole).not.toHaveBeenCalled();

    const fallback = renderVoting();
    await fallback.result.current.assignRoleToWinner('Chair', { termDuration: 'monthly' });
    expect(mocks.scheduleRoleRevote).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'role-1', groupId: 'group-1', termDuration: 'monthly' })
    );
    expect(mocks.updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_revote_date: 4_000_000 })
    );
  });

  it('rejects accepting or declining missing and foreign candidates', async () => {
    const { result } = renderVoting();
    await expect(result.current.acceptNomination('missing')).rejects.toThrow(
      'Cannot accept nomination for another user'
    );
    await expect(result.current.declineNomination('missing')).rejects.toThrow(
      'Cannot decline nomination for another user'
    );
    await expect(result.current.declineNomination('candidate-2')).rejects.toThrow(
      'Cannot decline nomination for another user'
    );
  });
});
