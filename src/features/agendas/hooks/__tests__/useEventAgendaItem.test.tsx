/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  user: { id: 'user-1' } as { id: string } | null,
  currentUser: { id: 'user-1', gender: 'female' } as any,
  canJoin: true,
  agendaDetail: { agendaItem: null as any, isLoading: false },
  agendaState: { agendaItems: [] as any[], isLoading: false },
  electionState: {
    election: null as any,
    candidates: [] as any[],
    electors: [] as any[],
    isLoading: false,
  },
  voteState: {
    vote: null as any,
    votesByAgendaItem: [] as any[],
    choices: [] as any[],
    isLoading: false,
  },
  forwardingContext: { isLoading: false, target: null } as any,
  deleteAgendaItem: vi.fn((id: string) => ({ kind: 'delete', id })),
  addSpeaker: vi.fn((args: unknown) => ({ kind: 'speaker', args })),
  electionIndicative: vi.fn((participation: unknown, selections: unknown) => ({
    kind: 'election-indicative',
    participation,
    selections,
  })),
  electionFinal: vi.fn((participation: unknown, selections: unknown) => ({
    kind: 'election-final',
    participation,
    selections,
  })),
  voteIndicative: vi.fn((participation: unknown, decisions: unknown) => ({
    kind: 'vote-indicative',
    participation,
    decisions,
  })),
  voteFinal: vi.fn((participation: unknown, decisions: unknown) => ({
    kind: 'vote-final',
    participation,
    decisions,
  })),
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
  quotaResult: { allowed: true } as any,
  validateQuota: vi.fn(),
  quotaMessage: vi.fn((..._args: unknown[]) => 'quota exceeded'),
  toastError: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: vi.fn() }) }));
vi.mock('@/features/agendas/logic/speakerListPermissions', () => ({
  canJoinEventSpeakerList: () => mocks.canJoin,
}));
vi.mock('@/zero/events/useEventState', () => ({
  useAgendaItemDetail: () => mocks.agendaDetail,
}));
vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaState: () => mocks.agendaState,
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    deleteAgendaItem: mocks.deleteAgendaItem,
    addSpeaker: mocks.addSpeaker,
  }),
}));
vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: () => mocks.electionState,
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    castIndicativeVote: mocks.electionIndicative,
    castFinalVote: mocks.electionFinal,
  }),
}));
vi.mock('@/zero/votes/useVoteState', () => ({ useVoteState: () => mocks.voteState }));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    castIndicativeVote: mocks.voteIndicative,
    castFinalVote: mocks.voteFinal,
  }),
}));
vi.mock('@/zero/amendments', () => ({
  useAgendaItemForwardingContext: () => mocks.forwardingContext,
}));
vi.mock('@/zero/shared', () => ({
  isNamedBallot: (visibility: string | null) => visibility === 'named',
}));
vi.mock('@/features/agendas/logic/speakerListGenderQuota', () => ({
  validateSpeakerGenderQuota: (args: unknown) => {
    mocks.validateQuota(args);
    return mocks.quotaResult;
  },
  getGenderQuotaFeedbackMessage: (...args: unknown[]) => mocks.quotaMessage(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

import { useEventAgendaItem } from '../useEventAgendaItem';

const agendaItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'agenda-1',
  event: { id: 'event-1', gender_quota_enabled: false },
  speaker_list: [],
  ...overrides,
});

const election = (overrides: Record<string, unknown> = {}) => ({
  id: 'election-1',
  status: 'indicative',
  ballot_visibility: 'named',
  ...overrides,
});

const vote = (overrides: Record<string, unknown> = {}) => ({
  id: 'vote-1',
  status: 'indicative',
  ballot_visibility: 'named',
  voters: [{ id: 'voter-1', user_id: 'user-1' }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.currentUser = { id: 'user-1', gender: 'female' };
  mocks.canJoin = true;
  mocks.agendaDetail.agendaItem = agendaItem();
  mocks.agendaDetail.isLoading = false;
  mocks.agendaState.agendaItems = [
    { id: 'agenda-1', calculated_start_time: '2026-08-09T10:00:00.000Z' },
  ];
  mocks.agendaState.isLoading = false;
  mocks.electionState.election = election();
  mocks.electionState.candidates = [{ id: 'candidate-1' }];
  mocks.electionState.electors = [{ id: 'elector-1', user_id: 'user-1' }];
  mocks.electionState.isLoading = false;
  mocks.voteState.vote = vote();
  mocks.voteState.votesByAgendaItem = [{ id: 'vote-1' }];
  mocks.voteState.choices = [{ id: 'choice-1' }];
  mocks.voteState.isLoading = false;
  mocks.forwardingContext = { isLoading: false, target: null };
  mocks.quotaResult = { allowed: true };
  mocks.waitForClientApply.mockResolvedValue(undefined);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
});

describe('useEventAgendaItem', () => {
  it('combines related state and resolves user participation records', () => {
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    expect(result.current).toMatchObject({
      agendaItem: { id: 'agenda-1' },
      event: { id: 'event-1' },
      userElector: { id: 'elector-1' },
      userVoter: { id: 'voter-1' },
      canJoinSpeakerList: true,
      isLoading: false,
    });
    expect(result.current.estimatedStartTime).toEqual(new Date('2026-08-09T10:00:00.000Z'));
  });

  it.each(['agendaDetail', 'electionState', 'voteState', 'agendaState', 'forwardingContext'])(
    'includes %s loading state',
    source => {
      (mocks[source as keyof typeof mocks] as { isLoading: boolean }).isLoading = true;
      const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));
      expect(result.current.isLoading).toBe(true);
    }
  );

  it('handles missing optional state', () => {
    mocks.user = null;
    mocks.currentUser = null;
    mocks.agendaDetail.agendaItem = null;
    mocks.agendaState.agendaItems = [];
    mocks.electionState.electors = [];
    mocks.voteState.vote = null;

    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    expect(result.current.event).toBeUndefined();
    expect(result.current.userElector).toBeUndefined();
    expect(result.current.userVoter).toBeUndefined();
    expect(result.current.estimatedStartTime).toBeUndefined();
  });

  it.each([
    ['user', null, election(), [{ id: 'elector-1', user_id: 'user-1' }]],
    ['election', { id: 'user-1' }, null, [{ id: 'elector-1', user_id: 'user-1' }]],
    ['elector', { id: 'user-1' }, election(), []],
  ])('guards election voting without %s', async (_label, user, electionValue, electors) => {
    mocks.user = user;
    mocks.electionState.election = electionValue;
    mocks.electionState.electors = electors;
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleElectionVote(['candidate-1']));

    expect(mocks.electionIndicative).not.toHaveBeenCalled();
    expect(result.current.votingLoading).toBeNull();
  });

  it.each([
    ['indicative named', 'indicative', 'named', 'indicative', 'elector participation'],
    ['final secret', 'closed', 'secret', 'final', null],
  ])(
    'casts an %s election vote',
    async (_label, status, visibility, expectedAction, expectedLink) => {
      mocks.electionState.election = election({ status, ballot_visibility: visibility });
      const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

      await act(() => result.current.handleElectionVote(['candidate-1', 'candidate-2']));

      const action =
        expectedAction === 'indicative' ? mocks.electionIndicative : mocks.electionFinal;
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({ election_id: 'election-1', elector_id: 'elector-1' }),
        [
          expect.objectContaining({
            candidate_id: 'candidate-1',
            elector_participation_id:
              expectedLink === null ? null : '00000000-0000-4000-8000-000000000001',
          }),
          expect.objectContaining({ candidate_id: 'candidate-2' }),
        ]
      );
      expect(mocks.waitForClientApply).toHaveBeenCalled();
      expect(result.current.votingLoading).toBeNull();
    }
  );

  it('recovers when election voting fails', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('election failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleElectionVote([]));

    expect(result.current.votingLoading).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    ['user', null, vote()],
    ['vote', { id: 'user-1' }, null],
    ['voter', { id: 'missing' }, vote()],
  ])('guards amendment voting without %s', async (_label, user, voteValue) => {
    mocks.user = user;
    mocks.voteState.vote = voteValue;
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAmendmentVote('choice-1'));

    expect(mocks.voteIndicative).not.toHaveBeenCalled();
  });

  it.each([
    ['indicative named', 'indicative', 'named', 'indicative', false],
    ['final secret', 'closed', 'secret', 'final', true],
  ])('casts an %s amendment vote', async (_label, status, visibility, expectedAction, secret) => {
    mocks.voteState.vote = vote({ status, ballot_visibility: visibility });
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAmendmentVote('choice-1'));

    const action = expectedAction === 'indicative' ? mocks.voteIndicative : mocks.voteFinal;
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-1', voter_id: 'voter-1' }),
      [
        expect.objectContaining({
          choice_id: 'choice-1',
          voter_participation_id: secret ? null : '00000000-0000-4000-8000-000000000001',
        }),
      ]
    );
    expect(result.current.votingLoading).toBeNull();
  });

  it('recovers when amendment voting fails', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('vote failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAmendmentVote('choice-1'));

    expect(result.current.votingLoading).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    ['user', null, agendaItem()],
    ['agenda item', { id: 'user-1' }, null],
  ])('guards deletion without %s', async (_label, user, item) => {
    mocks.user = user;
    mocks.agendaDetail.agendaItem = item;
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleDelete());

    expect(mocks.deleteAgendaItem).not.toHaveBeenCalled();
  });

  it('deletes the item and returns to the agenda', async () => {
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleDelete());

    expect(mocks.deleteAgendaItem).toHaveBeenCalledWith('agenda-1');
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/event-1/agenda' });
    expect(result.current.deleteLoading).toBe(false);
  });

  it('recovers when deletion fails', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('delete failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleDelete());

    expect(result.current.deleteLoading).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    ['user id', null, true, 'agenda-1'],
    ['agenda id', { id: 'user-1' }, true, ''],
    ['permission', { id: 'user-1' }, false, 'agenda-1'],
  ])('guards speaker-list joining without %s', async (_label, user, canJoin, itemId) => {
    mocks.user = user;
    mocks.canJoin = canJoin;
    const { result } = renderHook(() => useEventAgendaItem('event-1', itemId));

    await act(() => result.current.handleAddToSpeakerList());

    expect(mocks.addSpeaker).not.toHaveBeenCalled();
  });

  it('blocks a speaker who would violate the gender quota', async () => {
    mocks.agendaDetail.agendaItem = agendaItem({
      event: { id: 'event-1', gender_quota_enabled: true },
      speaker_list: undefined,
    });
    mocks.quotaResult = { allowed: false, reason: 'quota' };
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAddToSpeakerList());

    expect(mocks.validateQuota).toHaveBeenCalledWith({
      enabled: true,
      speakerGender: 'female',
      speakers: [],
    });
    expect(mocks.quotaMessage).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('quota exceeded');
    expect(mocks.addSpeaker).not.toHaveBeenCalled();
    expect(result.current.addingSpeaker).toBe(false);
  });

  it('appends the current user after the largest speaker order', async () => {
    mocks.currentUser = { id: 'user-1', gender: null };
    mocks.agendaDetail.agendaItem = agendaItem({
      event: { id: 'event-1', gender_quota_enabled: true },
      speaker_list: [{ order_index: null }, { order_index: 4 }],
    });
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAddToSpeakerList());

    expect(mocks.addSpeaker).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'generated.inline.0001_speaker_7c23b0d9',
      time: 3,
      completed: false,
      order_index: 5,
      user_id: 'user-1',
      agenda_item_id: 'agenda-1',
      start_time: null,
      end_time: null,
    });
    expect(result.current.addingSpeaker).toBe(false);
  });

  it('uses an empty-list order and disabled quota without an event user', async () => {
    mocks.currentUser = null;
    mocks.agendaDetail.agendaItem = agendaItem({ event: null, speaker_list: [] });
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAddToSpeakerList());

    expect(mocks.validateQuota).toHaveBeenCalledWith({
      enabled: false,
      speakerGender: null,
      speakers: [],
    });
    expect(mocks.addSpeaker).toHaveBeenCalledWith(expect.objectContaining({ order_index: 1 }));
  });

  it('recovers when joining the speaker list fails', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('speaker failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventAgendaItem('event-1', 'agenda-1'));

    await act(() => result.current.handleAddToSpeakerList());

    expect(result.current.addingSpeaker).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
