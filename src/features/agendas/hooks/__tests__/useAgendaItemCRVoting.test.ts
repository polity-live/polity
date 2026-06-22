/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  castFinalVote: vi.fn(),
  castIndicativeVote: vi.fn(),
  createVoter: vi.fn(),
  processCRVoteResult: vi.fn(),
  toastError: vi.fn(),
  updateAgendaItemChangeRequest: vi.fn(),
  updateVote: vi.fn(),
  useAgendaItemCRTimeline: vi.fn(),
}));

vi.mock('@/zero/agendas/useAgendaState', () => ({
  useAgendaItemCRTimeline: (...args: unknown[]) => mocks.useAgendaItemCRTimeline(...args),
}));

vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    updateAgendaItemChangeRequest: mocks.updateAgendaItemChangeRequest,
    processCRVoteResult: mocks.processCRVoteResult,
  }),
}));

vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    updateVote: mocks.updateVote,
    castIndicativeVote: mocks.castIndicativeVote,
    castFinalVote: mocks.castFinalVote,
    createVoter: mocks.createVoter,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));

import { getVoteResult, useAgendaItemCRVoting } from '../useAgendaItemCRVoting';

function setDefaultTimeline() {
  mocks.useAgendaItemCRTimeline.mockReturnValue({
    crTimeline: [],
    currentItem: null,
    pendingItems: [],
    completedItems: [],
    closingVoteItem: null,
    progress: 0,
    isLoading: false,
  });
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  setDefaultTimeline();
});

afterEach(() => {
  cleanup();
});

describe('getVoteResult', () => {
  it('treats accept/reject labels as decisive choices instead of reporting a tie', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
        choices: [
          { id: 'abstain', label: 'abstain', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'accept', label: 'accept', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('passed');
  });

  it('respects majority thresholds when resolving closed CR votes', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'two_thirds',
        voters: [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }, { id: 'v4' }],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [
          { choice_id: 'accept' },
          { choice_id: 'accept' },
          { choice_id: 'reject' },
        ],
      },
    } as never);

    expect(result).toBe('rejected');
  });

  it('includes final offline tallies when resolving a closed CR vote', () => {
    const result = getVoteResult({
      vote: {
        majority_type: 'simple',
        voters: [],
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        final_decisions: [],
        offline_tallies: [{ choice_id: 'accept', phase: 'final', count: 1 }],
      },
    } as never);

    expect(result).toBe('passed');
  });
});

describe('useAgendaItemCRVoting', () => {
  it('closes CR voting through updateVote without processing the CR result on the client', async () => {
    const item = {
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-1',
      is_closing_vote: false,
      status: 'voting',
      vote: {
        id: 'vote-1',
        status: 'final',
        majority_type: 'simple',
        choices: [
          { id: 'accept', label: 'accept', order_index: 0 },
          { id: 'reject', label: 'reject', order_index: 1 },
          { id: 'abstain', label: 'abstain', order_index: 2 },
        ],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        final_decisions: [{ choice_id: 'accept' }],
        offline_tallies: [],
      },
    };
    mocks.useAgendaItemCRTimeline.mockReturnValue({
      crTimeline: [item],
      currentItem: item,
      pendingItems: [],
      completedItems: [],
      closingVoteItem: null,
      progress: 0,
      isLoading: false,
    });

    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));
    let voteResult: unknown;

    await act(async () => {
      voteResult = await result.current.closeVoting('agenda-cr-1');
    });

    expect(voteResult).toBe('passed');
    expect(mocks.updateVote).toHaveBeenCalledWith({ id: 'vote-1', status: 'closed' });
    expect(mocks.processCRVoteResult).not.toHaveBeenCalled();
  });

  it('does not create participation records when a stale dialog submits a closed CR vote', async () => {
    const item = {
      id: 'agenda-cr-1',
      agenda_item_id: 'agenda-1',
      change_request_id: 'cr-1',
      vote_id: 'vote-1',
      is_closing_vote: false,
      status: 'completed',
      vote: {
        id: 'vote-1',
        status: 'closed',
        ballot_visibility: 'named',
        choices: [{ id: 'choice-yes', label: 'yes', order_index: 0 }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
        indicative_participations: [],
        final_participations: [],
      },
    };

    const { result } = renderHook(() => useAgendaItemCRVoting('agenda-1', 'user-1'));

    await act(async () => {
      await result.current.castCRVote(item as never, 'choice-yes');
    });

    expect(mocks.createVoter).not.toHaveBeenCalled();
    expect(mocks.castIndicativeVote).not.toHaveBeenCalled();
    expect(mocks.castFinalVote).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
