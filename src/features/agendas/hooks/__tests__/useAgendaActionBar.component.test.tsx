/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'user@example.com' } as any,
  currentUser: { id: 'user-1', gender: 'female' } as any,
  canManage: true,
  canManageSpeakers: true,
  canJoin: true,
  canVote: true,
  canBeCandidate: true,
  addSpeaker: vi.fn((args: unknown) => ({ kind: 'add-speaker', args })),
  removeSpeaker: vi.fn((id: string) => ({ kind: 'remove-speaker', id })),
  updateAgendaItem: vi.fn((args: unknown) => ({ kind: 'agenda', args })),
  addCandidate: vi.fn((args: unknown) => ({ kind: 'add-candidate', args })),
  deleteCandidate: vi.fn((id: string) => ({ kind: 'delete-candidate', id })),
  updateElection: vi.fn((args: unknown) => ({ kind: 'election', args })),
  updateVote: vi.fn((args: unknown) => ({ kind: 'vote', args })),
  verifyVotingPassword: vi.fn(async (_password: string) => undefined),
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
  voteCasting: { isIndicationPhase: false, marker: 'casting' } as any,
  voteCastingArgs: vi.fn(),
  quotaResult: { allowed: true } as any,
  validateQuota: vi.fn(),
  quotaMessage: vi.fn((..._args: unknown[]) => 'quota exceeded'),
  toastError: vi.fn(),
  createCorrelationId: vi.fn((flow: string) => `correlation:${flow}`),
  logFlow: vi.fn(),
  logFlowError: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({
    can: (action: string) =>
      action === 'manage'
        ? mocks.canManage
        : action === 'manage_speakers'
          ? mocks.canManageSpeakers
          : false,
    canVote: () => mocks.canVote,
    canBeCandidate: () => mocks.canBeCandidate,
  }),
}));
vi.mock('@/features/agendas/logic/speakerListPermissions', () => ({
  canJoinEventSpeakerList: () => mocks.canJoin,
}));
vi.mock('@/features/agendas/logic/speakerListGenderQuota', () => ({
  validateSpeakerGenderQuota: (args: unknown) => {
    mocks.validateQuota(args);
    return mocks.quotaResult;
  },
  getGenderQuotaFeedbackMessage: (...args: unknown[]) => mocks.quotaMessage(...args),
}));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    addSpeaker: mocks.addSpeaker,
    removeSpeaker: mocks.removeSpeaker,
    updateAgendaItem: mocks.updateAgendaItem,
  }),
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({
    addCandidate: mocks.addCandidate,
    deleteCandidate: mocks.deleteCandidate,
    updateElection: mocks.updateElection,
  }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({ updateVote: mocks.updateVote }),
}));
vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({ verifyVotingPassword: mocks.verifyVotingPassword }),
}));
vi.mock('@/features/vote-cast/hooks/useVoteCasting', () => ({
  useVoteCasting: (args: unknown) => {
    mocks.voteCastingArgs(args);
    return mocks.voteCasting;
  },
}));
vi.mock('@/zero/shared', () => ({
  defaultElectionBallotVisibility: 'secret',
  defaultVoteBallotVisibility: 'secret',
  isNamedBallot: (visibility: string | null) => visibility === 'named',
}));
vi.mock('@/features/elections/logic/electionFlowLogging', () => ({
  createElectionFlowCorrelationId: (flow: string) => mocks.createCorrelationId(flow),
  logElectionFlowClient: (...args: unknown[]) => mocks.logFlow(...args),
  logElectionFlowClientError: (...args: unknown[]) => mocks.logFlowError(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: mocks.toastError },
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: (error: unknown) =>
    `localized:${error instanceof Error ? error.message : String(error)}`,
}));

import { useAgendaActionBar } from '../useAgendaActionBar';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'agenda-1',
  type: 'election',
  status: 'active',
  voting_phase: 'indicative',
  speaker_list: [],
  ...overrides,
});

const election = (overrides: Record<string, unknown> = {}) => ({
  id: 'election-1',
  title: 'Board election',
  description: 'Choose the board',
  status: 'indicative',
  ballot_visibility: 'named',
  majority_type: 'relative',
  role: { title: 'Board member', name: 'Fallback role' },
  candidates: [] as any[],
  indicative_participations: [] as any[],
  ...overrides,
});

const vote = (overrides: Record<string, unknown> = {}) => ({
  id: 'vote-1',
  status: 'indicative',
  ballot_visibility: 'named',
  indicative_participations: [] as any[],
  ...overrides,
});

const options = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'event-1',
  eventTitle: 'Annual meeting',
  currentAgendaItem: item(),
  election: election(),
  vote: null,
  electorId: 'elector-1',
  voterId: 'voter-1',
  eventGenderQuotaEnabled: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1', email: 'user@example.com' };
  mocks.currentUser = { id: 'user-1', gender: 'female' };
  mocks.canManage = true;
  mocks.canManageSpeakers = true;
  mocks.canJoin = true;
  mocks.canVote = true;
  mocks.canBeCandidate = true;
  mocks.voteCasting = { isIndicationPhase: false, marker: 'casting' };
  mocks.quotaResult = { allowed: true };
  mocks.verifyVotingPassword.mockResolvedValue(undefined);
  mocks.waitForClientApply.mockResolvedValue(undefined);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
});

describe('useAgendaActionBar', () => {
  it('exposes permissions, dialog metadata, and vote-casting context', () => {
    const { result } = renderHook(() => useAgendaActionBar(options()));

    expect(result.current).toMatchObject({
      canManageAgenda: true,
      canManageSpeakers: true,
      canJoinSpeakerList: true,
      hasVotingRight: true,
      hasCandidateRight: true,
      isUserInSpeakerList: false,
      isUserCandidate: false,
      voteCasting: { marker: 'casting' },
    });
    expect(mocks.voteCastingArgs).toHaveBeenCalledWith({
      agendaItemId: 'agenda-1',
      electionId: 'election-1',
      voteId: undefined,
      eventId: 'event-1',
      status: 'indicative',
      electorId: 'elector-1',
      voterId: 'voter-1',
      ballotVisibility: 'named',
    });
    expect(result.current.candidacyDialogProps).toMatchObject({
      electionTitle: 'Board election',
      electionDescription: 'Choose the board',
      roleTitle: 'Board member',
      candidatesCount: 0,
      majorityType: 'relative',
    });
  });

  it.each([
    ['agenda fallback', options({ currentAgendaItem: item({ voting_phase: null }) }), 'indicative'],
    [
      'vote fallback',
      options({ currentAgendaItem: item({ voting_phase: null }), election: null, vote: vote() }),
      'indicative',
    ],
    ['empty context', options({ currentAgendaItem: null, election: null, vote: null }), undefined],
  ])('derives vote-casting values from the %s', (_label, hookOptions, status) => {
    renderHook(() => useAgendaActionBar(hookOptions as any));
    expect(mocks.voteCastingArgs).toHaveBeenCalledWith(
      expect.objectContaining({
        agendaItemId: hookOptions.currentAgendaItem?.id ?? '',
        status,
      })
    );
  });

  it.each([
    ['nested user', [{ id: 'speaker-1', user: { id: 'user-1' }, completed: false }], true],
    ['direct user', [{ id: 'speaker-1', user_id: 'user-1', completed: false }], true],
    ['completed entry', [{ id: 'speaker-1', user_id: 'user-1', completed: true }], false],
    ['different user', [{ id: 'speaker-1', user_id: 'other', completed: false }], false],
  ])('derives speaker membership for %s', (_label, speakerList, expected) => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: item({ speaker_list: speakerList }) }))
    );
    expect(result.current.isUserInSpeakerList).toBe(expected);
  });

  it.each([
    ['missing user', null, item({ speaker_list: [] })],
    ['missing list', { id: 'user-1' }, item({ speaker_list: undefined })],
  ])('has no speaker membership with %s', (_label, user, currentAgendaItem) => {
    mocks.user = user;
    const { result } = renderHook(() => useAgendaActionBar(options({ currentAgendaItem })));
    expect(result.current.isUserInSpeakerList).toBe(false);
  });

  it.each([
    ['nested candidate', [{ id: 'candidate-1', user: { id: 'user-1' } }], true],
    ['direct candidate', [{ id: 'candidate-1', user_id: 'user-1' }], true],
    ['different candidate', [{ id: 'candidate-1', user_id: 'other' }], false],
  ])('derives candidacy for %s', (_label, candidates, expected) => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ election: election({ candidates }) }))
    );
    expect(result.current.isUserCandidate).toBe(expected);
  });

  it.each([
    ['missing user', null, election()],
    ['missing candidates', { id: 'user-1' }, election({ candidates: null })],
  ])('has no candidacy with %s', (_label, user, electionValue) => {
    mocks.user = user;
    const { result } = renderHook(() => useAgendaActionBar(options({ election: electionValue })));
    expect(result.current.isUserCandidate).toBe(false);
  });

  it.each([
    [
      'election user id',
      options({
        election: election({ indicative_participations: [{ user_id: 'user-1' }] }),
      }),
    ],
    [
      'election elector id',
      options({
        election: election({ indicative_participations: [{ elector_id: 'elector-1' }] }),
      }),
    ],
    [
      'vote user id',
      options({
        election: null,
        vote: vote({ indicative_participations: [{ user_id: 'user-1' }] }),
      }),
    ],
    [
      'vote voter id',
      options({
        election: null,
        vote: vote({ indicative_participations: [{ voter_id: 'voter-1' }] }),
      }),
    ],
  ])('disables a secret indicative ballot after %s participation', (_label, hookOptions) => {
    mocks.voteCasting = { isIndicationPhase: true };
    const mutableOptions = hookOptions as unknown as {
      election: { ballot_visibility: string } | null;
      vote: { ballot_visibility: string } | null;
    };
    if (mutableOptions.election) mutableOptions.election.ballot_visibility = 'secret';
    if (mutableOptions.vote) mutableOptions.vote.ballot_visibility = 'secret';

    const { result } = renderHook(() => useAgendaActionBar(hookOptions as any));

    expect(result.current.disableSecretIndicativeVoteButton).toBe(true);
    expect(result.current.secretIndicativeVoteTooltip).toBe(
      'features.events.agenda.actions.secretIndicativeVoteAlreadyCast'
    );
  });

  it.each([
    ['not indicative', { isIndicationPhase: false }, 'secret', [{ user_id: 'user-1' }]],
    ['named ballot', { isIndicationPhase: true }, 'named', [{ user_id: 'user-1' }]],
    ['no participation', { isIndicationPhase: true }, 'secret', null],
  ])('keeps voting enabled for %s', (_label, casting, visibility, participations) => {
    mocks.voteCasting = casting;
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          election: election({
            ballot_visibility: visibility,
            indicative_participations: participations,
          }),
        })
      )
    );
    expect(result.current.disableSecretIndicativeVoteButton).toBe(false);
    expect(result.current.secretIndicativeVoteTooltip).toBeNull();
  });

  it('uses vote defaults when a secret vote has no participation collection', () => {
    mocks.voteCasting = { isIndicationPhase: true };
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          election: null,
          vote: vote({ ballot_visibility: null, indicative_participations: null }),
        })
      )
    );
    expect(result.current.disableSecretIndicativeVoteButton).toBe(false);
  });

  it('uses ballot and candidacy metadata fallbacks', () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          eventTitle: 'Fallback event',
          election: election({
            title: null,
            description: null,
            ballot_visibility: null,
            role: { title: null, name: 'Named role' },
            candidates: null,
            majority_type: null,
          }),
        })
      )
    );
    expect(result.current.candidacyDialogProps).toMatchObject({
      electionTitle: 'Fallback event',
      electionDescription: null,
      roleTitle: 'Named role',
      candidatesCount: null,
      majorityType: null,
    });
  });

  it('uses null candidacy metadata without an election or event title', () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ eventTitle: null, election: null, vote: null }))
    );
    expect(result.current.candidacyDialogProps).toMatchObject({
      electionTitle: null,
      electionDescription: null,
      roleTitle: null,
      candidatesCount: null,
      majorityType: null,
    });
    expect(result.current.disableSecretIndicativeVoteButton).toBe(false);
  });

  it.each([
    ['missing user', null, election(), true],
    ['missing election', { id: 'user-1' }, null, true],
    ['missing right', { id: 'user-1' }, election(), false],
  ])('guards becoming a candidate with %s', async (_label, user, electionValue, right) => {
    mocks.user = user;
    mocks.canBeCandidate = right;
    const { result } = renderHook(() => useAgendaActionBar(options({ election: electionValue })));

    await act(() => result.current.handleBecomeCandidate());

    expect(result.current.candidacyDialogProps.open).toBe(false);
  });

  it('opens and submits candidacy using the user email', async () => {
    const { result } = renderHook(() => useAgendaActionBar(options()));

    await act(() => result.current.handleBecomeCandidate());
    expect(result.current.candidacyDialogProps).toMatchObject({ open: true, mode: 'become' });
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));

    expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('secret');
    expect(mocks.addCandidate).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'user@example.com',
      description: '',
      image_url: '',
      order_index: 1,
      status: 'nominated',
      user_id: 'user-1',
      election_id: 'election-1',
    });
    expect(result.current.candidacyDialogProps.open).toBe(false);
    expect(result.current.candidacyDialogProps.isSubmitting).toBe(false);
  });

  it('uses a translated candidate name and next candidate order', async () => {
    mocks.user = { id: 'user-1', email: '' };
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({ election: election({ candidates: [{ id: 'existing', user_id: 'other' }] }) })
      )
    );

    await act(() => result.current.handleBecomeCandidate());
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));

    expect(mocks.addCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'features.events.agenda.candidate',
        order_index: 2,
      })
    );
  });

  it('starts candidate ordering at one when candidates are unavailable', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ election: election({ candidates: null }) }))
    );
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));
    expect(mocks.addCandidate).toHaveBeenCalledWith(expect.objectContaining({ order_index: 1 }));
  });

  it.each([
    ['missing user', null, election(), true],
    ['missing election', { id: 'user-1' }, null, true],
    ['missing candidate right', { id: 'user-1' }, election(), false],
  ])('guards direct candidacy submission with %s', async (_label, user, electionValue, right) => {
    mocks.user = user;
    mocks.canBeCandidate = right;
    const { result } = renderHook(() => useAgendaActionBar(options({ election: electionValue })));
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));
    expect(mocks.addCandidate).not.toHaveBeenCalled();
  });

  it.each([
    ['missing user', null, [{ id: 'candidate-1', user_id: 'user-1' }]],
    ['missing candidate', { id: 'user-1' }, []],
  ])('guards withdrawing with %s', async (_label, user, candidates) => {
    mocks.user = user;
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ election: election({ candidates }) }))
    );
    await act(() => result.current.handleWithdrawCandidacy());
    expect(result.current.candidacyDialogProps.open).toBe(false);
  });

  it('opens and submits candidacy withdrawal', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({ election: election({ candidates: [{ id: 'candidate-1', user_id: 'user-1' }] }) })
      )
    );

    await act(() => result.current.handleWithdrawCandidacy());
    expect(result.current.candidacyDialogProps.mode).toBe('withdraw');
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));

    expect(mocks.deleteCandidate).toHaveBeenCalledWith('candidate-1');
    expect(result.current.candidacyDialogProps.open).toBe(false);
  });

  it.each([
    ['missing user', null, [{ id: 'candidate-1', user_id: 'user-1' }]],
    ['missing candidate', { id: 'user-1' }, []],
  ])('guards direct withdrawal submission with %s', async (_label, user, nextCandidates) => {
    const initialOptions = options({
      election: election({ candidates: [{ id: 'candidate-1', user_id: 'user-1' }] }),
    });
    const { result, rerender } = renderHook(
      ({ hookOptions }) => useAgendaActionBar(hookOptions as any),
      { initialProps: { hookOptions: initialOptions } }
    );
    await act(() => result.current.handleWithdrawCandidacy());
    mocks.user = user;
    rerender({
      hookOptions: options({ election: election({ candidates: nextCandidates }) }),
    });
    await act(() => result.current.candidacyDialogProps.onSubmit('secret'));
    expect(mocks.deleteCandidate).not.toHaveBeenCalled();
  });

  it('shows and clears voting-password failures', async () => {
    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('wrong password'));
    const { result } = renderHook(() => useAgendaActionBar(options()));

    await act(() => result.current.handleBecomeCandidate());
    await act(() => result.current.candidacyDialogProps.onSubmit('wrong'));

    expect(result.current.candidacyDialogProps).toMatchObject({
      open: true,
      error: 'localized:wrong password',
      isSubmitting: false,
    });
    act(() => result.current.candidacyDialogProps.onOpenChange(true));
    expect(result.current.candidacyDialogProps.error).toBe('localized:wrong password');
    act(() => result.current.candidacyDialogProps.onOpenChange(false));
    expect(result.current.candidacyDialogProps).toMatchObject({ open: false, error: null });
  });

  it.each([
    ['missing user', null, item(), true],
    ['missing item', { id: 'user-1' }, null, true],
    ['missing permission', { id: 'user-1' }, item(), false],
  ])(
    'guards joining the speaker list with %s',
    async (_label, user, currentAgendaItem, canJoin) => {
      mocks.user = user;
      mocks.canJoin = canJoin;
      const { result } = renderHook(() => useAgendaActionBar(options({ currentAgendaItem })));
      await act(() => result.current.handleJoinSpeakerList());
      expect(mocks.addSpeaker).not.toHaveBeenCalled();
    }
  );

  it('blocks joining when the gender quota rejects the user', async () => {
    mocks.quotaResult = { allowed: false, reason: 'quota' };
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          eventGenderQuotaEnabled: true,
          currentAgendaItem: item({ speaker_list: undefined }),
        })
      )
    );

    await act(() => result.current.handleJoinSpeakerList());

    expect(mocks.validateQuota).toHaveBeenCalledWith({
      enabled: true,
      speakerGender: 'female',
      speakers: [],
    });
    expect(mocks.toastError).toHaveBeenCalledWith('quota exceeded');
    expect(mocks.addSpeaker).not.toHaveBeenCalled();
  });

  it('joins at the next speaker-list position', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          currentAgendaItem: item({ speaker_list: [{ id: 'speaker-1', user_id: 'other' }] }),
        })
      )
    );

    await act(() => result.current.handleJoinSpeakerList());

    expect(mocks.addSpeaker).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_item_id: 'agenda-1', user_id: 'user-1', order_index: 2 })
    );
    expect(result.current.speakerLoading).toBe(false);
  });

  it('uses disabled quota defaults and recovers from join failures', async () => {
    mocks.currentUser = null;
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('join failed'));
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ eventGenderQuotaEnabled: true }))
    );

    await act(() => result.current.handleJoinSpeakerList());

    expect(mocks.validateQuota).toHaveBeenCalledWith({
      enabled: false,
      speakerGender: null,
      speakers: [],
    });
    expect(result.current.speakerLoading).toBe(false);
  });

  it('joins an unavailable speaker list at position one', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: item({ speaker_list: undefined }) }))
    );
    await act(() => result.current.handleJoinSpeakerList());
    expect(mocks.addSpeaker).toHaveBeenCalledWith(expect.objectContaining({ order_index: 1 }));
  });

  it.each([
    ['missing user', null, []],
    ['missing list', { id: 'user-1' }, undefined],
    ['missing active entry', { id: 'user-1' }, [{ id: 'speaker-1', user_id: 'other' }]],
    [
      'completed entry',
      { id: 'user-1' },
      [{ id: 'speaker-1', user_id: 'user-1', completed: true }],
    ],
  ])('guards leaving for %s', async (_label, user, speakerList) => {
    mocks.user = user;
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: item({ speaker_list: speakerList }) }))
    );
    await act(() => result.current.handleLeaveSpeakerList());
    expect(mocks.removeSpeaker).not.toHaveBeenCalled();
  });

  it.each([
    ['nested user', { id: 'speaker-1', user: { id: 'user-1' } }],
    ['direct user', { id: 'speaker-1', user_id: 'user-1' }],
  ])('leaves an active %s speaker entry', async (_label, speaker) => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: item({ speaker_list: [speaker] }) }))
    );
    await act(() => result.current.handleLeaveSpeakerList());
    expect(mocks.removeSpeaker).toHaveBeenCalledWith('speaker-1');
    expect(result.current.speakerLoading).toBe(false);
  });

  it('recovers from leave failures', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('leave failed'));
    const { result } = renderHook(() =>
      useAgendaActionBar(
        options({
          currentAgendaItem: item({ speaker_list: [{ id: 'speaker-1', user_id: 'user-1' }] }),
        })
      )
    );
    await act(() => result.current.handleLeaveSpeakerList());
    expect(result.current.speakerLoading).toBe(false);
  });

  it('guards vote administration without permission', async () => {
    mocks.canManage = false;
    const { result } = renderHook(() => useAgendaActionBar(options()));

    await act(() => result.current.handleStartVote());
    await act(() => result.current.handleStartFinalVote());
    await act(() => result.current.handleCloseFinalVote());

    expect(mocks.updateElection).not.toHaveBeenCalled();
    expect(mocks.createCorrelationId).not.toHaveBeenCalled();
  });

  it('starts an indicative election and updates the agenda phase', async () => {
    const { result } = renderHook(() => useAgendaActionBar(options()));
    await act(() => result.current.handleStartVote());
    expect(mocks.updateElection).toHaveBeenCalledWith({
      id: 'election-1',
      status: 'indicative',
      closing_end_time: null,
    });
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith({
      id: 'agenda-1',
      voting_phase: 'indicative',
    });
  });

  it('starts an indicative standalone vote', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ election: null, vote: vote() }))
    );
    await act(() => result.current.handleStartVote());
    expect(mocks.updateVote).toHaveBeenCalledWith({
      id: 'vote-1',
      status: 'indicative',
      closing_end_time: null,
    });
  });

  it('allows phase handling without a ballot or agenda item', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: null, election: null, vote: null }))
    );
    await act(() => result.current.handleStartVote());
    await act(() => result.current.handleStartFinalVote());
    expect(mocks.updateElection).not.toHaveBeenCalled();
    expect(mocks.updateVote).not.toHaveBeenCalled();
    expect(mocks.updateAgendaItem).not.toHaveBeenCalled();
  });

  it.each([
    [
      'timed election',
      options({ election: election({ closing_duration_seconds: 30 }) }),
      'election',
    ],
    [
      'untimed election',
      options({ election: election({ closing_duration_seconds: null }) }),
      'election',
    ],
    [
      'timed vote',
      options({ election: null, vote: vote({ closing_duration_seconds: 45 }) }),
      'vote',
    ],
    [
      'untimed vote',
      options({ election: null, vote: vote({ closing_duration_seconds: null }) }),
      'vote',
    ],
  ])('starts a %s final ballot', async (_label, hookOptions, kind) => {
    const { result } = renderHook(() => useAgendaActionBar(hookOptions as any));
    await act(() => result.current.handleStartFinalVote());
    const action = kind === 'election' ? mocks.updateElection : mocks.updateVote;
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ status: 'final' }));
    const ballot = (kind === 'election' ? hookOptions.election : hookOptions.vote) as unknown as {
      closing_duration_seconds?: number | null;
    } | null;
    if (ballot?.closing_duration_seconds == null) {
      expect(action).toHaveBeenCalledWith(expect.objectContaining({ closing_end_time: null }));
    } else {
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({ closing_end_time: expect.any(Number) })
      );
    }
    expect(mocks.updateAgendaItem).toHaveBeenCalledWith({
      id: 'agenda-1',
      voting_phase: 'final',
    });
  });

  it.each([
    ['election', options(), 'election-close-final-vote'],
    ['vote', options({ election: null, vote: vote() }), 'vote-close-final-vote'],
    ['no ballot', options({ election: null, vote: null }), 'vote-close-final-vote'],
  ])('closes a %s final ballot and records the flow', async (_label, hookOptions, flow) => {
    const { result } = renderHook(() => useAgendaActionBar(hookOptions as any));

    await act(() => result.current.handleCloseFinalVote());

    expect(mocks.createCorrelationId).toHaveBeenCalledWith(flow);
    expect(mocks.logFlow).toHaveBeenNthCalledWith(
      1,
      flow,
      'submit-started',
      expect.objectContaining({ correlationId: `correlation:${flow}` })
    );
    expect(mocks.logFlow).toHaveBeenLastCalledWith(
      flow,
      'submit-confirmed',
      expect.objectContaining({ agendaItemId: 'agenda-1' })
    );
    if (hookOptions.election) {
      expect(mocks.updateElection).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed', debug_correlation_id: `correlation:${flow}` })
      );
    } else if (hookOptions.vote) {
      expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });
    }
  });

  it('closes without an agenda item using null logging metadata', async () => {
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: null, election: null, vote: vote() }))
    );
    await act(() => result.current.handleCloseFinalVote());
    expect(mocks.logFlow).toHaveBeenCalledWith(
      'vote-close-final-vote',
      'submit-confirmed',
      expect.objectContaining({ agendaItemId: null, electionId: null, voteId: 'vote-1' })
    );
  });

  it.each([
    ['Error', new Error('close failed'), 'close failed'],
    ['non-Error', 'rejected', 'rejected'],
  ])('logs and rethrows %s close failures', async (_label, failure, message) => {
    mocks.waitForClientApply.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useAgendaActionBar(options()));

    await expect(
      act(async () => {
        await result.current.handleCloseFinalVote();
      })
    ).rejects.toBe(failure);

    expect(mocks.logFlowError).toHaveBeenCalledWith(
      'election-close-final-vote',
      'submit-failed',
      expect.objectContaining({ error: message })
    );
  });

  it('logs null ballot and agenda metadata on a failed close', async () => {
    const failure = new Error('close failed');
    mocks.waitForClientApply.mockRejectedValueOnce(failure);
    const { result } = renderHook(() =>
      useAgendaActionBar(options({ currentAgendaItem: null, election: null, vote: vote() }))
    );
    await expect(
      act(async () => {
        await result.current.handleCloseFinalVote();
      })
    ).rejects.toBe(failure);
    expect(mocks.logFlowError).toHaveBeenCalledWith(
      'vote-close-final-vote',
      'submit-failed',
      expect.objectContaining({ agendaItemId: null, electionId: null })
    );
  });

  it('opens vote and edit dialogs', () => {
    const { result } = renderHook(() => useAgendaActionBar(options()));
    act(() => result.current.handleVoteClick());
    act(() => result.current.handleEditClick());
    expect(result.current.voteDialogOpen).toBe(true);
    expect(result.current.editDialogOpen).toBe(true);
    act(() => result.current.setVoteDialogOpen(false));
    act(() => result.current.setEditDialogOpen(false));
    expect(result.current.voteDialogOpen).toBe(false);
    expect(result.current.editDialogOpen).toBe(false);
  });
});
