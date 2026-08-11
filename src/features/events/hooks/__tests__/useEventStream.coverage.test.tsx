/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventStream } from '../useEventStream';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  currentUser: { gender: 'female' } as { gender?: string | null } | null,
  event: null as any,
  isLoading: false,
  canJoin: true,
  quotaAllowed: true,
  addSpeaker: vi.fn(),
  removeSpeaker: vi.fn(),
  castElectionIndicative: vi.fn(),
  castElectionFinal: vi.fn(),
  castVoteIndicative: vi.fn(),
  castVoteFinal: vi.fn(),
  calculateSpeakerTime: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  toastError: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: vi.fn() }) }));
vi.mock('@/features/agendas/logic/speakerListPermissions', () => ({
  canJoinEventSpeakerList: () => mocks.canJoin,
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventStreamData: () => ({ event: mocks.event, isLoading: mocks.isLoading }),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ addSpeaker: mocks.addSpeaker, removeSpeaker: mocks.removeSpeaker }),
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    castIndicativeVote: mocks.castElectionIndicative,
    castFinalVote: mocks.castElectionFinal,
  }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    castIndicativeVote: mocks.castVoteIndicative,
    castFinalVote: mocks.castVoteFinal,
  }),
}));
vi.mock('../../logic/eventStreamHelpers', () => ({
  calculateSpeakerTime: mocks.calculateSpeakerTime,
  formatTime: vi.fn(),
}));
vi.mock('@/zero/shared', () => ({
  isNamedBallot: (visibility: string) => visibility === 'named',
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('@/features/agendas/logic/speakerListGenderQuota', () => ({
  validateSpeakerGenderQuota: () => ({ allowed: mocks.quotaAllowed, reason: 'quota' }),
  getGenderQuotaFeedbackMessage: () => 'quota feedback',
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));

function agendaEvent(agendaItem: Record<string, unknown>) {
  return { agenda_items: [agendaItem] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.currentUser = { gender: 'female' };
  mocks.event = null;
  mocks.isLoading = false;
  mocks.canJoin = true;
  mocks.quotaAllowed = true;
  mocks.addSpeaker.mockResolvedValue(undefined);
  mocks.removeSpeaker.mockResolvedValue(undefined);
  mocks.castElectionIndicative.mockResolvedValue(undefined);
  mocks.castElectionFinal.mockResolvedValue(undefined);
  mocks.castVoteIndicative.mockResolvedValue(undefined);
  mocks.castVoteFinal.mockResolvedValue(undefined);
  mocks.calculateSpeakerTime.mockReturnValue(new Date('2026-08-09T12:03:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(cleanup);

describe('useEventStream coverage', () => {
  it('selects in-progress, pending, and ordered fallback agenda items', () => {
    mocks.event = {
      agenda_items: [
        { id: 'pending', order_index: 5, status: 'pending' },
        { id: 'progress', order_index: 9, status: 'in-progress' },
      ],
    };
    const hook = renderHook(() => useEventStream('event-1'));
    expect(hook.result.current.currentAgendaItem?.id).toBe('progress');

    mocks.event = {
      agenda_items: [
        { id: 'other', order_index: 1, status: 'completed' },
        { id: 'pending', order_index: 2, status: 'pending' },
      ],
    };
    hook.rerender();
    expect(hook.result.current.currentAgendaItem?.id).toBe('pending');

    mocks.event = {
      agenda_items: [
        { id: 'later', order_index: 4, status: 'completed' },
        { id: 'default-order', order_index: null, status: 'completed' },
        { id: 'middle', order_index: 2, status: 'completed' },
      ],
    };
    hook.rerender();
    expect(hook.result.current.currentAgendaItem?.id).toBe('default-order');

    mocks.event = { agenda_items: null };
    hook.rerender();
    expect(hook.result.current.currentAgendaItem).toBeUndefined();
  });

  it('sorts speakers, resolves the current user, and calculates explicit or current starts', () => {
    mocks.event = agendaEvent({
      id: 'agenda-1',
      status: 'pending',
      start_time: '2026-08-09T10:00:00Z',
      speaker_list: [
        { id: 'later', order_index: 2, user: null },
        { id: 'mine', order_index: null, user: { id: 'user-1' } },
      ],
    });
    const hook = renderHook(() => useEventStream('event-1'));
    expect(hook.result.current.speakerList.map(speaker => speaker.id)).toEqual(['mine', 'later']);
    expect(hook.result.current.userSpeaker?.id).toBe('mine');
    hook.result.current.calculateSpeakerTime(1);
    expect(mocks.calculateSpeakerTime).toHaveBeenCalledWith(
      1,
      hook.result.current.speakerList,
      new Date('2026-08-09T10:00:00Z')
    );

    mocks.event = agendaEvent({ id: 'agenda-2', status: 'pending', speaker_list: null });
    hook.rerender();
    expect(hook.result.current.speakerList).toEqual([]);
    hook.result.current.calculateSpeakerTime(0);
    expect(mocks.calculateSpeakerTime.mock.calls[1]![2]).toBeInstanceOf(Date);
  });

  it('refreshes current time every minute and clears the interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const hook = renderHook(() => useEventStream('event-1'));
    act(() => vi.advanceTimersByTime(60_000));
    hook.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('guards adding a speaker and reports a gender-quota denial', async () => {
    mocks.user = null;
    let hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    hook.unmount();

    mocks.user = { id: 'user-1' };
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    hook.unmount();

    mocks.event = agendaEvent({ id: 'agenda-1', status: 'pending' });
    mocks.canJoin = false;
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    hook.unmount();

    mocks.canJoin = true;
    mocks.quotaAllowed = false;
    mocks.currentUser = null;
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    expect(mocks.toastError).toHaveBeenCalledWith('quota feedback');
    expect(mocks.addSpeaker).not.toHaveBeenCalled();
    expect(hook.result.current.addingSpeaker).toBe(false);
  });

  it('adds after existing speakers and handles add failures and an empty list', async () => {
    mocks.event = {
      agenda_items: [
        {
          id: 'agenda-1',
          speaker_list: [
            { id: 'speaker-1', order_index: null },
            { id: 'speaker-2', order_index: 4 },
          ],
          status: 'pending',
        },
      ],
      gender_quota_enabled: true,
    };
    let hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    expect(mocks.addSpeaker).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_item_id: 'agenda-1', order_index: 5, user_id: 'user-1' })
    );
    hook.unmount();

    mocks.event = agendaEvent({ id: 'agenda-2', speaker_list: [], status: 'pending' });
    mocks.currentUser = { gender: null };
    mocks.addSpeaker.mockRejectedValueOnce(new Error('add failed'));
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAddToSpeakerList());
    expect(console.error).toHaveBeenCalledWith('Error adding to speaker list:', expect.any(Error));
    expect(hook.result.current.addingSpeaker).toBe(false);
  });

  it('guards, removes, and recovers from failed speaker removals', async () => {
    mocks.user = null;
    let hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleRemoveFromSpeakerList('speaker-1'));
    expect(mocks.removeSpeaker).not.toHaveBeenCalled();
    hook.unmount();

    mocks.user = { id: 'user-1' };
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleRemoveFromSpeakerList('speaker-1'));
    expect(mocks.removeSpeaker).toHaveBeenCalledWith('speaker-1');

    mocks.removeSpeaker.mockRejectedValueOnce(new Error('remove failed'));
    await act(() => hook.result.current.handleRemoveFromSpeakerList('speaker-2'));
    expect(console.error).toHaveBeenCalledWith(
      'Error removing from speaker list:',
      expect.any(Error)
    );
    expect(hook.result.current.removingSpeaker).toBeNull();
  });

  it('guards missing election votes and casts indicative and final ballot variants', async () => {
    mocks.user = null;
    let hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleElectionVote('election-1', 'candidate-1'));
    hook.unmount();

    mocks.user = { id: 'user-1' };
    mocks.event = agendaEvent({ id: 'agenda-1', status: 'pending' });
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleElectionVote('missing', 'candidate-1'));
    expect(hook.result.current.votingLoading).toBeNull();
    hook.unmount();

    mocks.event = agendaEvent({
      election: [
        {
          ballot_visibility: 'named',
          electors: [{ id: 'elector-1', user_id: 'user-1' }],
          id: 'election-1',
          status: 'indicative',
        },
      ],
      id: 'agenda-1',
      status: 'pending',
    });
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleElectionVote('election-1', 'candidate-1'));
    expect(mocks.castElectionIndicative).toHaveBeenCalledWith(
      expect.objectContaining({ elector_id: 'elector-1' }),
      [expect.objectContaining({ elector_participation_id: expect.any(String) })]
    );
    hook.unmount();

    mocks.event = agendaEvent({
      election: [
        {
          ballot_visibility: 'secret',
          electors: undefined,
          id: 'election-2',
          status: 'final',
        },
      ],
      id: 'agenda-1',
      status: 'pending',
    });
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleElectionVote('election-2', 'candidate-2'));
    expect(mocks.castElectionFinal).toHaveBeenCalledWith(
      expect.objectContaining({ elector_id: 'snapshot-resolved:user-1' }),
      [expect.objectContaining({ elector_participation_id: null })]
    );
  });

  it('covers the opposite election visibility branches and vote errors', async () => {
    mocks.event = agendaEvent({
      election: [
        { ballot_visibility: 'secret', id: 'indicative', status: 'indicative' },
        { ballot_visibility: 'named', id: 'final', status: 'final' },
      ],
      id: 'agenda-1',
      status: 'pending',
    });
    const hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleElectionVote('indicative', 'candidate-1'));
    await act(() => hook.result.current.handleElectionVote('final', 'candidate-1'));
    expect(mocks.castElectionIndicative.mock.calls.at(-1)?.[1][0]).toMatchObject({
      elector_participation_id: null,
    });
    expect(mocks.castElectionFinal.mock.calls.at(-1)?.[1][0].elector_participation_id).toEqual(
      expect.any(String)
    );

    mocks.castElectionFinal.mockRejectedValueOnce(new Error('vote failed'));
    await act(() => hook.result.current.handleElectionVote('final', 'candidate-1'));
    expect(console.error).toHaveBeenCalledWith('Error voting:', expect.any(Error));
  });

  it('guards missing amendment votes and casts every phase and visibility variant', async () => {
    mocks.user = null;
    let hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAmendmentVote('vote-1', 'choice-1'));
    hook.unmount();

    mocks.user = { id: 'user-1' };
    mocks.event = agendaEvent({ id: 'agenda-1', status: 'pending' });
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAmendmentVote('missing', 'choice-1'));
    hook.unmount();

    mocks.event = agendaEvent({
      id: 'agenda-1',
      status: 'pending',
      votes: [
        {
          ballot_visibility: 'named',
          id: 'indicative-named',
          status: 'indicative',
          voters: [{ id: 'voter-1', user_id: 'user-1' }],
        },
        { ballot_visibility: 'secret', id: 'indicative-secret', status: 'indicative' },
        { ballot_visibility: 'named', id: 'final-named', status: 'final' },
        { ballot_visibility: 'secret', id: 'final-secret', status: 'final' },
      ],
    });
    hook = renderHook(() => useEventStream('event-1'));
    await act(() => hook.result.current.handleAmendmentVote('indicative-named', 'choice-1'));
    await act(() => hook.result.current.handleAmendmentVote('indicative-secret', 'choice-2'));
    await act(() => hook.result.current.handleAmendmentVote('final-named', 'choice-3'));
    await act(() => hook.result.current.handleAmendmentVote('final-secret', 'choice-4'));

    expect(mocks.castVoteIndicative.mock.calls[0]![0]).toMatchObject({ voter_id: 'voter-1' });
    expect(mocks.castVoteIndicative.mock.calls[0]![1][0].voter_participation_id).toEqual(
      expect.any(String)
    );
    expect(mocks.castVoteIndicative.mock.calls[1]![0]).toMatchObject({
      voter_id: 'snapshot-resolved:user-1',
    });
    expect(mocks.castVoteIndicative.mock.calls[1]![1][0]).toMatchObject({
      voter_participation_id: null,
    });
    expect(mocks.castVoteFinal.mock.calls[0]![1][0].voter_participation_id).toEqual(
      expect.any(String)
    );
    expect(mocks.castVoteFinal.mock.calls[1]![1][0]).toMatchObject({
      voter_participation_id: null,
    });

    mocks.castVoteFinal.mockRejectedValueOnce(new Error('vote failed'));
    await act(() => hook.result.current.handleAmendmentVote('final-secret', 'choice-4'));
    expect(console.error).toHaveBeenCalledWith('Error voting:', expect.any(Error));
    expect(hook.result.current.votingLoading).toBeNull();
  });
});
