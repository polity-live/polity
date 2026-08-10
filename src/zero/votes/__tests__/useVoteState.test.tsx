/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = [unknown, { type: 'unknown' | 'complete' }];

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  useQuery: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));

vi.mock('../../queries', () => {
  const query = (name: string, args: unknown) => ({ key: `${name}:${JSON.stringify(args)}` });
  return {
    queries: {
      votes: {
        votesWithDetails: (args: unknown) => query('details', args),
        byAgendaItem: (args: unknown) => query('agenda', args),
        byId: (args: unknown) => query('id', args),
        choicesByVote: (args: unknown) => query('choices', args),
        userIndicativeParticipation: (args: unknown) => query('indicative', args),
        userFinalParticipation: (args: unknown) => query('final', args),
      },
    },
  };
});

import { useVoteState } from '../useVoteState';

function key(name: string, args: unknown) {
  return `${name}:${JSON.stringify(args)}`;
}

function setResult(name: string, args: unknown, value: unknown, type: 'unknown' | 'complete' = 'complete') {
  mocks.results.set(key(name, args), [value, { type }]);
}

beforeEach(() => {
  mocks.results.clear();
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((query?: { key: string }) =>
    query ? (mocks.results.get(query.key) ?? [undefined, { type: 'complete' }]) : [undefined, { type: 'complete' }]
  );
});

describe('useVoteState', () => {
  it('returns stable empty defaults without an active scope', () => {
    expect(renderHook(() => useVoteState()).result.current).toEqual({
      vote: null,
      votesWithDetails: [],
      votesByAgendaItem: [],
      choices: [],
      userIndicativeParticipation: null,
      userFinalParticipation: null,
      isLoading: false,
    });
    expect(mocks.useQuery.mock.calls.every(([query]) => query === undefined)).toBe(true);
  });

  it('resolves a vote from an agenda item and falls back to its embedded choices', () => {
    const agendaVote = { id: 'vote-agenda', choices: [{ id: 'embedded-choice' }] };
    setResult('agenda', { agenda_item_id: 'agenda-1' }, [agendaVote]);
    setResult(
      'indicative',
      { vote_id: 'vote-agenda', voter_id: 'user-1' },
      { id: 'indicative-1' }
    );
    setResult('final', { vote_id: 'vote-agenda', voter_id: 'user-1' }, { id: 'final-1' });

    const state = renderHook(() =>
      useVoteState({ agendaItemId: 'agenda-1', voterId: 'user-1' })
    ).result.current;

    expect(state).toMatchObject({
      vote: agendaVote,
      votesByAgendaItem: [agendaVote],
      choices: [{ id: 'embedded-choice' }],
      userIndicativeParticipation: { id: 'indicative-1' },
      userFinalParticipation: { id: 'final-1' },
      isLoading: false,
    });
  });

  it('prioritizes an explicit vote id and external choices', () => {
    const vote = { id: 'vote-1', choices: [{ id: 'embedded-choice' }] };
    setResult('details', {}, [{ id: 'detailed-1' }]);
    setResult('agenda', { agenda_item_id: 'agenda-1' }, [{ id: 'agenda-vote' }]);
    setResult('id', { id: 'vote-1' }, vote);
    setResult('choices', { vote_id: 'vote-1' }, [{ id: 'external-choice' }]);

    const state = renderHook(() =>
      useVoteState({
        agendaItemId: 'agenda-1',
        voteId: 'vote-1',
        includeVotesWithDetails: true,
      })
    ).result.current;

    expect(state).toMatchObject({
      vote,
      votesWithDetails: [{ id: 'detailed-1' }],
      choices: [{ id: 'external-choice' }],
      isLoading: false,
    });
    expect(mocks.useQuery).toHaveBeenCalledWith({ key: 'choices:{"vote_id":"vote-1"}' });
  });

  it('does not query participation until both vote and voter are known', () => {
    renderHook(() => useVoteState({ voteId: 'vote-1' }));
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toBeUndefined();

    mocks.useQuery.mockClear();
    renderHook(() => useVoteState({ voterId: 'user-1' }));
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it.each(['details', 'agenda', 'id', 'choices', 'indicative', 'final'] as const)(
    'reports the %s loading boundary',
    loadingQuery => {
      const argsByName = {
        details: {},
        agenda: { agenda_item_id: 'agenda-1' },
        id: { id: 'vote-1' },
        choices: { vote_id: 'vote-1' },
        indicative: { vote_id: 'vote-1', voter_id: 'user-1' },
        final: { vote_id: 'vote-1', voter_id: 'user-1' },
      };
      setResult(loadingQuery, argsByName[loadingQuery], undefined, 'unknown');

      const state = renderHook(() =>
        useVoteState({
          agendaItemId: 'agenda-1',
          voteId: 'vote-1',
          voterId: 'user-1',
          includeVotesWithDetails: true,
        })
      ).result.current;

      expect(state.isLoading).toBe(true);
    }
  );
});
