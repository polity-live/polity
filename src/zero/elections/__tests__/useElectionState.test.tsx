/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = [unknown, { type: 'unknown' | 'complete' }];

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  useQuery: vi.fn(),
  resolveMode: vi.fn(),
  resolveSeats: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));

vi.mock('@/features/elections/logic/electionAssignmentMetadata', () => ({
  parseDelegateElectionMetadata: (description?: string | null) =>
    description === 'delegate-meta' ? { mode: 'role_based', seatRoleIds: ['role-1', 'role-2'] } : null,
}));

vi.mock('@/features/elections/logic/electionMode', () => ({
  resolveElectionMode: mocks.resolveMode,
  resolveElectionSeatCount: mocks.resolveSeats,
}));

vi.mock('../../queries', () => {
  const query = (name: string, args: unknown) => ({ key: `${name}:${JSON.stringify(args)}` });
  return {
    queries: {
      elections: {
        byAgendaItem: (args: unknown) => query('agenda', args),
        byId: (args: unknown) => query('id', args),
        candidatesByElection: (args: unknown) => query('candidates', args),
        electorsByElection: (args: unknown) => query('electors', args),
        userIndicativeParticipation: (args: unknown) => query('indicative', args),
        userFinalParticipation: (args: unknown) => query('final', args),
        electionsWithDetails: (args: unknown) => query('details', args),
        electionsForSearch: (args: unknown) => query('search', args),
        pendingElections: (args: unknown) => query('pending', args),
      },
    },
  };
});

import { normalizeElectionRow, useElectionState } from '../useElectionState';

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
  mocks.resolveMode.mockReset();
  mocks.resolveMode.mockReturnValue('single');
  mocks.resolveSeats.mockReset();
  mocks.resolveSeats.mockReturnValue(1);
});

describe('normalizeElectionRow', () => {
  it('returns null for absent rows', () => {
    expect(normalizeElectionRow(null)).toBeNull();
    expect(normalizeElectionRow(undefined)).toBeNull();
  });

  it('normalizes legacy fields without delegate metadata', () => {
    const row = { id: 'election-1', description: null, election_mode: null, seat_count: 2, max_votes: 3 };
    expect(normalizeElectionRow(row)).toEqual({ ...row, election_mode: 'single', seat_count: 1 });
    expect(mocks.resolveMode).toHaveBeenCalledWith(expect.objectContaining({ delegateAssignmentMode: null }));
    expect(mocks.resolveSeats).toHaveBeenCalledWith(expect.objectContaining({ fallbackSeatCount: null }));
  });

  it('attaches parsed delegate metadata and its seat fallback', () => {
    const row = { id: 'election-1', description: 'delegate-meta', election_mode: null, seat_count: null, max_votes: null };
    expect(normalizeElectionRow(row)).toMatchObject({
      delegate_assignment_meta: { mode: 'role_based', seatRoleIds: ['role-1', 'role-2'] },
      election_mode: 'single',
      seat_count: 1,
    });
    expect(mocks.resolveSeats).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackSeatCount: 2, delegateAssignmentMode: 'role_based' })
    );
  });
});

describe('useElectionState', () => {
  it('returns stable empty defaults without an active scope', () => {
    expect(renderHook(() => useElectionState()).result.current).toEqual({
      election: null,
      electionsByAgendaItem: [],
      candidates: [],
      electors: [],
      userIndicativeParticipation: null,
      userFinalParticipation: null,
      electionsWithDetails: [],
      electionsForSearch: [],
      pendingElections: [],
      isLoading: false,
    });
  });

  it('resolves an agenda election with embedded candidates and electors', () => {
    const election = {
      id: 'agenda-election',
      description: null,
      candidates: [{ id: 'embedded-candidate' }],
      electors: [{ id: 'embedded-elector' }],
    };
    setResult('agenda', { agenda_item_id: 'agenda-1' }, [election]);

    const state = renderHook(() => useElectionState({ agendaItemId: 'agenda-1' })).result.current;

    expect(state.election).toMatchObject({ id: 'agenda-election' });
    expect(state.electionsByAgendaItem).toHaveLength(1);
    expect(state.candidates).toEqual([{ id: 'embedded-candidate' }]);
    expect(state.electors).toEqual([{ id: 'embedded-elector' }]);
  });

  it('prioritizes an explicit election and returns every opt-in query', () => {
    const election = { id: 'election-1', description: 'delegate-meta', candidates: undefined, electors: undefined };
    setResult('agenda', { agenda_item_id: 'agenda-1' }, [{ id: 'agenda-election' }]);
    setResult('id', { id: 'election-1' }, election);
    setResult('candidates', { election_id: 'election-1' }, [{ id: 'candidate-1' }]);
    setResult('electors', { election_id: 'election-1' }, [{ id: 'elector-1' }]);
    setResult('indicative', { election_id: 'election-1', elector_id: 'user-1' }, { id: 'indicative-1' });
    setResult('final', { election_id: 'election-1', elector_id: 'user-1' }, { id: 'final-1' });
    setResult('details', {}, [{ id: 'detailed-1' }]);
    setResult('search', {}, [{ id: 'search-1' }]);
    setResult('pending', {}, [{ id: 'pending-1' }]);

    const state = renderHook(() =>
      useElectionState({
        agendaItemId: 'agenda-1',
        electionId: 'election-1',
        electorId: 'user-1',
        includeElectionsWithDetails: true,
        includeElectionsForSearch: true,
        includePendingElections: true,
      })
    ).result.current;

    expect(state).toMatchObject({
      election: { id: 'election-1' },
      candidates: [{ id: 'candidate-1' }],
      electors: [{ id: 'elector-1' }],
      userIndicativeParticipation: { id: 'indicative-1' },
      userFinalParticipation: { id: 'final-1' },
      electionsWithDetails: [{ id: 'detailed-1' }],
      electionsForSearch: [{ id: 'search-1' }],
      pendingElections: [{ id: 'pending-1' }],
      isLoading: false,
    });
  });

  it('does not query participation without both election and elector', () => {
    renderHook(() => useElectionState({ electionId: 'election-1' }));
    expect(mocks.useQuery.mock.calls[4]?.[0]).toBeUndefined();
    expect(mocks.useQuery.mock.calls[5]?.[0]).toBeUndefined();

    mocks.useQuery.mockClear();
    renderHook(() => useElectionState({ electorId: 'user-1' }));
    expect(mocks.useQuery.mock.calls[4]?.[0]).toBeUndefined();
    expect(mocks.useQuery.mock.calls[5]?.[0]).toBeUndefined();
  });

  it.each([
    ['agenda', { agendaItemId: 'agenda-1' }, { agenda_item_id: 'agenda-1' }],
    ['id', { electionId: 'election-1' }, { id: 'election-1' }],
    ['candidates', { electionId: 'election-1' }, { election_id: 'election-1' }],
    ['electors', { electionId: 'election-1' }, { election_id: 'election-1' }],
    ['indicative', { electionId: 'election-1', electorId: 'user-1' }, { election_id: 'election-1', elector_id: 'user-1' }],
    ['final', { electionId: 'election-1', electorId: 'user-1' }, { election_id: 'election-1', elector_id: 'user-1' }],
    ['details', { includeElectionsWithDetails: true }, {}],
    ['search', { includeElectionsForSearch: true }, {}],
    ['pending', { includePendingElections: true }, {}],
  ] as const)('reports the %s loading boundary', (name, options, args) => {
    setResult(name, args, undefined, 'unknown');
    expect(renderHook(() => useElectionState(options)).result.current.isLoading).toBe(true);
  });
});
