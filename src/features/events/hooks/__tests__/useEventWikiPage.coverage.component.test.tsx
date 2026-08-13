/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEventWikiPage } from '../useEventWikiPage';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'ada@example.test' } as Record<string, any> | null,
  allUsers: [] as Record<string, any>[] | null,
  event: null as Record<string, any> | null,
  agendaItems: null as Record<string, any>[] | null,
  eventLoading: false,
  addCandidate: vi.fn(),
  verifyVotingPassword: vi.fn(),
  navigate: vi.fn(),
  subscribeData: { isSubscribed: false, subscriberCount: 2, isLoading: false },
  participationData: { isParticipant: false, hasRequested: false, isInvited: false },
  computeAgendaStats: vi.fn(() => ({ electionsCount: 0 })),
  checkEntityAccess: vi.fn(() => true),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useEventWikiData: () => ({
    event: mocks.event,
    agendaItems: mocks.agendaItems,
    isLoading: mocks.eventLoading,
  }),
}));
vi.mock('@/zero/users', () => ({ useUserState: () => ({ allUsers: mocks.allUsers }) }));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ addCandidate: mocks.addCandidate }),
}));
vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({ verifyVotingPassword: mocks.verifyVotingPassword }),
}));
vi.mock('../useSubscribeEvent', () => ({ useSubscribeEvent: () => mocks.subscribeData }));
vi.mock('../useEventParticipation', () => ({
  useEventParticipation: () => mocks.participationData,
}));
vi.mock('@/features/agendas/logic/computeAgendaStats', () => ({
  computeAgendaStats: mocks.computeAgendaStats,
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: mocks.checkEntityAccess,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/notifications/utils/voting-password-error-toast', () => ({
  isVotingPasswordError: (message: string) => message.includes('password'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1', email: 'ada@example.test' };
  mocks.allUsers = [];
  mocks.event = null;
  mocks.agendaItems = null;
  mocks.eventLoading = false;
  mocks.participationData = { isParticipant: false, hasRequested: false, isInvited: false };
  mocks.addCandidate.mockResolvedValue(undefined);
  mocks.verifyVotingPassword.mockResolvedValue(undefined);
  mocks.computeAgendaStats.mockReturnValue({ electionsCount: 0 });
  mocks.checkEntityAccess.mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(cleanup);

describe('useEventWikiPage coverage', () => {
  it('filters agenda rows, flattens elections, and delegates access state', () => {
    const election = { id: 'election-1', candidates: [] };
    mocks.event = { title: 'Event', visibility: 'private' };
    mocks.agendaItems = [
      { id: 'match', event: { id: 'event-1' }, election: [election] },
      { id: 'match-without-election', event: { id: 'event-1' }, election: null },
      { id: 'other', event: { id: 'event-2' }, election: null },
      { id: 'missing-event', event: null, election: [election] },
    ];
    mocks.participationData.isParticipant = true;
    const { result } = renderHook(() => useEventWikiPage('event-1'));

    expect(result.current.agendaItems.map(item => item.id)).toEqual([
      'match',
      'match-without-election',
    ]);
    expect(result.current.elections).toEqual([election]);
    expect(mocks.computeAgendaStats).toHaveBeenCalledWith(result.current.agendaItems);
    expect(mocks.checkEntityAccess).toHaveBeenCalledWith('private', true, true);
    expect(result.current.canAccess).toBe(true);
    expect(result.current.subscriberCount).toBe(2);
  });

  it('handles anonymous and absent-list fallbacks and guards confirmation', async () => {
    mocks.user = null;
    mocks.allUsers = null;
    const { result } = renderHook(() => useEventWikiPage('event-1'));
    expect(result.current.agendaItems).toEqual([]);
    expect(result.current.elections).toEqual([]);
    expect(result.current.getUserCandidacy({ candidates: undefined } as never)).toBeUndefined();
    await act(() => result.current.handleConfirmCandidacy('secret'));
    expect(mocks.verifyVotingPassword).not.toHaveBeenCalled();
    expect(mocks.checkEntityAccess).toHaveBeenCalledWith(undefined, false, false);
  });

  it('opens confirmation and rejects an existing candidacy', async () => {
    const election = {
      id: 'election-1',
      candidates: [{ id: 'candidate-1', user: { id: 'user-1' } }],
    };
    const { result } = renderHook(() => useEventWikiPage('event-1'));
    await act(() => result.current.handleConfirmCandidacy('before-selection'));
    expect(mocks.verifyVotingPassword).not.toHaveBeenCalled();

    act(() => result.current.setElectionsDialogOpen(true));
    act(() => result.current.handleElectionClick(election as never));
    expect(result.current.selectedElection).toBe(election);
    expect(result.current.electionsDialogOpen).toBe(false);
    expect(result.current.confirmDialogOpen).toBe(true);

    await act(() => result.current.handleConfirmCandidacy('secret'));
    expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('secret');
    expect(mocks.addCandidate).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(result.current.confirmDialogOpen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('adds a sorted candidate using the current profile', async () => {
    mocks.allUsers = [
      { id: 'other', first_name: 'Other' },
      { id: 'user-1', first_name: 'Ada', avatar: 'avatar.png' },
    ];
    const election = {
      id: 'election-1',
      candidates: [
        { order_index: null, user: null },
        { order_index: 4, user: { id: 'other' } },
      ],
    };
    const { result } = renderHook(() => useEventWikiPage('event-1'));
    act(() => result.current.handleElectionClick(election as never));
    await act(() => result.current.handleConfirmCandidacy('secret'));

    expect(mocks.addCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada',
        image_url: 'avatar.png',
        order_index: 5,
        election_id: 'election-1',
        user_id: 'user-1',
      })
    );
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(result.current.selectedElection).toBeNull();
    expect(result.current.confirmDialogOpen).toBe(false);
  });

  it('falls back through email, unnamed identity, empty candidates, and avatar', async () => {
    mocks.allUsers = [{ id: 'user-1', first_name: '', avatar: '' }];
    const emailElection = { id: 'email-election', candidates: null };
    const hook = renderHook(() => useEventWikiPage('event-1'));
    act(() => hook.result.current.handleElectionClick(emailElection as never));
    await act(() => hook.result.current.handleConfirmCandidacy('secret'));
    expect(mocks.addCandidate).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'ada@example.test', image_url: '', order_index: 1 })
    );
    hook.unmount();

    mocks.user = { id: 'user-1' };
    mocks.allUsers = null;
    const unnamed = renderHook(() => useEventWikiPage('event-1'));
    act(() => unnamed.result.current.handleElectionClick({ id: 'unnamed' } as never));
    await act(() => unnamed.result.current.handleConfirmCandidacy('secret'));
    expect(mocks.addCandidate).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Unbenannt', image_url: '' })
    );
  });

  it('stores password errors without a duplicate toast', async () => {
    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('password invalid'));
    const { result } = renderHook(() => useEventWikiPage('event-1'));
    act(() => result.current.handleElectionClick({ id: 'election-1' } as never));
    await act(() => result.current.handleConfirmCandidacy('bad'));

    expect(result.current.candidacyPasswordError).toBe('password invalid');
    expect(mocks.error).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('translates non-error failures and emits a generic error toast', async () => {
    mocks.verifyVotingPassword.mockRejectedValueOnce('broken');
    const { result } = renderHook(() => useEventWikiPage('event-1'));
    act(() => result.current.handleElectionClick({ id: 'election-1', candidates: [] } as never));
    await act(() => result.current.handleConfirmCandidacy('bad'));

    expect(result.current.candidacyPasswordError).toBe(
      'generated.inline.0481_fehler_beim_hinzuf_gen_des_kandidaten_bitte_v_14c00c58'
    );
    expect(mocks.error).toHaveBeenCalledOnce();
  });
});
