/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventVoting } from '../useEventVoting';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as null | { id: string },
  event: null as any,
  queryLoading: false,
  permissions: { manage: true, vote: true },
  createVote: vi.fn(),
  updateVote: vi.fn(),
  castFinalVote: vi.fn(),
  updateAgendaItem: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  serverConfirmed: vi.fn(async (value: unknown) => await value),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useEventWithVoting: () => ({ event: mocks.event, isLoading: mocks.queryLoading }),
}));
vi.mock('@/zero/agendas', () => ({
  useAgendaActions: () => ({ updateAgendaItem: mocks.updateAgendaItem }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    createVote: mocks.createVote,
    updateVote: mocks.updateVote,
    castFinalVote: mocks.castFinalVote,
  }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    can: (action: string, entity: string) =>
      entity === 'agendaItems' && action === 'manage'
        ? mocks.permissions.manage
        : entity === 'events' && action === 'active_voting'
          ? mocks.permissions.vote
          : false,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(args[0]),
  serverConfirmed: (...args: unknown[]) => mocks.serverConfirmed(args[0]),
}));

function eventFixture() {
  return {
    id: 'event-1',
    title: 'Assembly',
    participants: [],
    agenda_items: [
      {
        id: 'agenda-1',
        type: 'amendment',
        amendment_id: 'amendment-1',
        voting_phase: 'voting',
        majority_type: 'simple',
        start_time: Date.now(),
        votes: [
          {
            id: 'vote-1',
            ballot_visibility: 'named',
            electorate_snapshotted_at: Date.now(),
            offline_electorate_size: 1,
            choices: [
              { id: 'choice-accept', label: 'accept' },
              { id: 'choice-reject', label: 'reject' },
              { id: 'choice-abstain', label: 'abstain' },
            ],
            voters: [
              {
                id: 'voter-1',
                user_id: 'user-1',
                participation_channel: 'online',
                user: { first_name: 'Ada', last_name: 'Lovelace' },
              },
              {
                id: 'voter-2',
                user_id: 'user-2',
                participation_channel: 'online',
                user: { first_name: 'Grace', last_name: 'Hopper' },
              },
            ],
            final_participations: [{ id: 'participation-2', voter_id: 'voter-2' }],
            final_decisions: [
              {
                id: 'decision-2',
                choice_id: 'choice-reject',
                voter_participation_id: 'user-2',
              },
            ],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.permissions = { manage: true, vote: true };
  mocks.queryLoading = false;
  mocks.event = eventFixture();
  mocks.createVote.mockResolvedValue(undefined);
  mocks.updateVote.mockResolvedValue(undefined);
  mocks.castFinalVote.mockResolvedValue(undefined);
  mocks.updateAgendaItem.mockResolvedValue(undefined);
  let sequence = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
  );
});

describe('useEventVoting', () => {
  it('derives the frozen electorate, turnout, named results, and voting permissions', () => {
    const { result } = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(result.current).toMatchObject({
      currentSession: expect.objectContaining({ id: 'agenda-1', phase: 'voting' }),
      eligibleVoters: [
        { id: 'user-1', name: 'Ada Lovelace', hasVoted: false },
        { id: 'user-2', name: 'Grace Hopper', hasVoted: true },
      ],
      votedCount: 1,
      totalVoters: 3,
      canVote: true,
      canManageVoting: true,
      hasUserVoted: false,
      voteResults: { accept: 0, reject: 1, abstain: 0 },
    });
  });

  it('creates a session, casts a named final decision, and closes its vote record', async () => {
    const { result } = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(async () => {
      await result.current.startIntroductionPhase({
        agendaItemId: 'agenda-1',
        votingType: 'amendment',
        targetEntityId: 'amendment-1',
      });
    });
    expect(mocks.createVote).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_item_id: 'agenda-1', purpose: 'closing' })
    );
    await act(async () => result.current.startVotingPhase('agenda-1', 300));
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith({
      id: 'agenda-1',
      voting_phase: 'indicative',
    });

    await act(async () => result.current.castVote('agenda-1', 'accept'));
    expect(mocks.castFinalVote).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-1', voter_id: expect.any(String) }),
      [
        expect.objectContaining({
          vote_id: 'vote-1',
          choice_id: 'choice-accept',
          voter_participation_id: expect.any(String),
        }),
      ],
      expect.objectContaining({
        voter: expect.objectContaining({ user_id: 'user-1' }),
        silent: true,
      })
    );
    await act(async () => result.current.closeVoting('agenda-1'));
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agenda-1', voting_phase: 'closed' })
    );
  });

  it('blocks unauthenticated management and invalid or duplicate voting before mutation', async () => {
    mocks.user = null;
    mocks.permissions = { manage: false, vote: false };
    const { result } = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await expect(
      result.current.startIntroductionPhase({
        agendaItemId: 'agenda-1',
        votingType: 'amendment',
        targetEntityId: 'amendment-1',
      })
    ).rejects.toThrow('Permission denied');
    await act(async () => result.current.castVote('agenda-1', 'accept'));
    expect(mocks.castFinalVote).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('handles missing events, agenda ids, sessions, votes, and participant lists', () => {
    mocks.event = null;
    const missingEvent = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(missingEvent.result.current).toMatchObject({
      currentSession: null,
      eligibleVoters: [],
      totalVoters: 0,
      hasUserVoted: false,
      userVote: null,
    });

    mocks.event = { id: 'event-1', participants: [], agenda_items: [] };
    const noAgenda = renderHook(() => useEventVoting('event-1'));
    expect(noAgenda.result.current.currentSession).toBeNull();

    mocks.event = { id: 'event-1', participants: undefined, agenda_items: [{ id: 'other' }] };
    const missingParticipants = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(missingParticipants.result.current.eligibleVoters).toEqual([]);
  });

  it('normalizes sparse legacy agenda decisions and session defaults', () => {
    mocks.event = {
      id: 'event-1',
      participants: [],
      agenda_items: [
        {
          id: 'agenda-1',
          type: null,
          amendment_id: null,
          voting_phase: 'introduction',
          start_time: null,
          end_time: null,
          majority_type: null,
          votes: [
            {
              id: 'vote-1',
              electorate_snapshotted_at: null,
              choices: [],
              final_decisions: [{ id: 'd1', choice_id: 'missing', voter_participation_id: null }],
            },
          ],
        },
      ],
    };
    const { result } = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(result.current.currentSession).toEqual(
      expect.objectContaining({
        phase: 'introduction',
        votingType: 'amendment',
        startedAt: undefined,
        endedAt: undefined,
        majorityType: 'simple',
        targetEntityId: '',
        votes: [{ id: 'd1', vote: 'abstain', voter: { id: '' } }],
      })
    );
    expect(result.current.voteResults).toEqual({ accept: 0, reject: 0, abstain: 1 });

    mocks.event.agenda_items[0].votes = undefined;
    const noVotes = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(noVotes.result.current.currentSession?.votes).toEqual([]);

    mocks.event.agenda_items[0].votes = [{ id: 'vote-empty', final_decisions: undefined }];
    const noDecisions = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(noDecisions.result.current.currentSession?.votes).toEqual([]);
  });

  it('derives snapshot and live-electorate identity fallbacks', () => {
    mocks.event = eventFixture();
    const vote = mocks.event.agenda_items[0].votes[0];
    vote.voters = [
      { id: 'voter-1', user_id: 'user-1', participation_channel: 'offline', user: null },
      {
        id: 'voter-2',
        user_id: 'user-2',
        participation_channel: 'online',
        user: { first_name: '', last_name: '' },
      },
    ];
    vote.final_participations = [{ id: 'p1', voter_id: 'voter-1' }];
    vote.offline_electorate_size = null;
    vote.final_decisions = [
      { id: 'd1', choice_id: 'choice-accept', voter_participation_id: 'user-1' },
    ];
    const snapshot = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(snapshot.result.current).toMatchObject({
      eligibleVoters: [
        { id: 'user-1', name: undefined, hasVoted: true },
        { id: 'user-2', name: undefined, hasVoted: false },
      ],
      totalVoters: 1,
      canVote: false,
      hasUserVoted: true,
      userVote: 'accept',
    });

    vote.electorate_snapshotted_at = null;
    mocks.event.participants = [];
    const live = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(live.result.current).toMatchObject({ totalVoters: 0, canVote: true });

    mocks.event = eventFixture();
    const emptySnapshotVote = mocks.event.agenda_items[0].votes[0];
    emptySnapshotVote.voters = undefined;
    emptySnapshotVote.final_participations = undefined;
    emptySnapshotVote.offline_electorate_size = undefined;
    const emptySnapshot = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    expect(emptySnapshot.result.current).toMatchObject({
      eligibleVoters: [],
      totalVoters: 0,
      canVote: false,
      hasUserVoted: false,
    });
  });

  it('covers every cast guard before the final mutation', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => anonymous.result.current.castVote('agenda-1', 'accept'));

    mocks.user = { id: 'user-1' };
    mocks.permissions.vote = false;
    mocks.event.agenda_items[0].votes[0].electorate_snapshotted_at = null;
    const denied = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => denied.result.current.castVote('agenda-1', 'accept'));

    mocks.permissions.vote = true;
    mocks.event = eventFixture();
    mocks.event.agenda_items[0].votes[0].final_participations = [{ id: 'p1', voter_id: 'voter-1' }];
    const duplicate = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => duplicate.result.current.castVote('agenda-1', 'accept'));

    mocks.event = eventFixture();
    mocks.event.agenda_items[0].voting_phase = 'introduction';
    const inactive = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => inactive.result.current.castVote('agenda-1', 'accept'));

    mocks.event = eventFixture();
    mocks.event.agenda_items[0].votes = [];
    const noVote = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => noVote.result.current.castVote('agenda-1', 'accept'));

    mocks.event = eventFixture();
    mocks.event.agenda_items[0].votes[0].choices = [];
    mocks.castFinalVote.mockClear();
    const noChoice = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => noChoice.result.current.castVote('agenda-1', 'accept'));
    expect(mocks.castFinalVote).not.toHaveBeenCalled();
  });

  it('casts secret ballots without a participation link', async () => {
    mocks.event = eventFixture();
    mocks.event.agenda_items[0].votes[0].ballot_visibility = 'secret';
    const { result } = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => result.current.castVote('agenda-1', 'accept'));
    expect(mocks.castFinalVote.mock.calls[0][1][0].voter_participation_id).toBeNull();
  });

  it('covers management denial and all mutation failure boundaries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.permissions.manage = false;
    const denied = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => denied.result.current.startVotingPhase('agenda-1'));

    mocks.permissions.manage = true;
    mocks.createVote.mockRejectedValueOnce(new Error('start introduction'));
    const start = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await expect(
      act(() =>
        start.result.current.startIntroductionPhase({
          agendaItemId: 'agenda-1',
          votingType: 'amendment',
          targetEntityId: 'amendment-1',
          majorityType: 'absolute',
        })
      )
    ).rejects.toThrow('start introduction');

    mocks.updateAgendaItem.mockRejectedValueOnce(new Error('start voting'));
    await expect(act(() => start.result.current.startVotingPhase('agenda-1'))).rejects.toThrow(
      'start voting'
    );

    mocks.updateAgendaItem.mockResolvedValue(undefined);
    mocks.updateVote.mockRejectedValueOnce(new Error('close vote'));
    await expect(act(() => start.result.current.closeVoting('agenda-1'))).rejects.toThrow(
      'close vote'
    );

    mocks.castFinalVote.mockRejectedValueOnce(new Error('cast vote'));
    await expect(act(() => start.result.current.castVote('agenda-1', 'accept'))).rejects.toThrow(
      'cast vote'
    );
    expect(consoleError).toHaveBeenCalledTimes(4);
    consoleError.mockRestore();
  });

  it('closes without a vote record and ignores close requests from anonymous users', async () => {
    mocks.event = eventFixture();
    mocks.event.agenda_items[0].votes = [];
    const noVote = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => noVote.result.current.closeVoting('agenda-1'));
    expect(mocks.updateVote).not.toHaveBeenCalled();
    expect(mocks.updateAgendaItem).toHaveBeenCalled();

    mocks.event = eventFixture();
    mocks.event.agenda_items[0].voting_phase = 'closed';
    const noActiveSession = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => noActiveSession.result.current.closeVoting('agenda-1'));
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });

    mocks.user = null;
    const anonymous = renderHook(() => useEventVoting('event-1', 'agenda-1'));
    await act(() => anonymous.result.current.closeVoting('agenda-1'));
  });
});
