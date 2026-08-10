import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = [unknown, { type: 'unknown' | 'complete' }];

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  useQuery: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('../../queries', () => {
  const query = (name: string, args: unknown) => ({ key: `${name}:${JSON.stringify(args)}` });
  return {
    queries: {
      network: {
        groupConnectionsByGroup: (args: unknown) => query('connections:group', args),
        groupConnectionsByPair: (args: unknown) => query('connections:pair', args),
        groupConnectionRequestsByGroup: (args: unknown) => query('requests:group', args),
        groupConnectionRequestsByPair: (args: unknown) => query('requests:pair', args),
        groupConnectionById: (args: unknown) => query('connection:id', args),
        allGroupConnections: (args: unknown) => query('connections:all', args),
      },
    },
  };
});

import { useGroupConnectionState } from '../useGroupConnectionState';

function key(name: string, args: unknown) {
  return `${name}:${JSON.stringify(args)}`;
}

function setResult(name: string, args: unknown, value: unknown, type: 'unknown' | 'complete') {
  mocks.results.set(key(name, args), [value, { type }]);
}

beforeEach(() => {
  mocks.results.clear();
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((query?: { key: string }) =>
    query ? (mocks.results.get(query.key) ?? [undefined, { type: 'complete' }]) : [undefined, { type: 'complete' }]
  );
});

describe('useGroupConnectionState', () => {
  it('loads all connections by default when no specific scope exists', () => {
    setResult('connections:all', {}, [{ id: 'all-1' }], 'unknown');

    expect(useGroupConnectionState()).toEqual({
      groupConnections: [],
      groupConnectionsLoading: false,
      pairConnections: [],
      pairConnectionsLoading: false,
      groupConnectionRequests: [],
      groupConnectionRequestsLoading: false,
      pairConnectionRequests: [],
      pairConnectionRequestsLoading: false,
      connection: undefined,
      connectionLoading: false,
      allConnections: [{ id: 'all-1' }],
      allConnectionsLoading: true,
    });
  });

  it('loads group connections and requests without implicitly loading all', () => {
    setResult('connections:group', { groupId: 'group-1' }, [{ id: 'connection-1' }], 'unknown');
    setResult('requests:group', { groupId: 'group-1' }, [{ id: 'request-1' }], 'complete');

    const state = useGroupConnectionState({ groupId: 'group-1' });

    expect(state).toMatchObject({
      groupConnections: [{ id: 'connection-1' }],
      groupConnectionsLoading: true,
      groupConnectionRequests: [{ id: 'request-1' }],
      groupConnectionRequestsLoading: false,
      allConnections: [],
      allConnectionsLoading: false,
    });
  });

  it('loads pair connections and requests only when both group ids exist', () => {
    const args = { groupAId: 'group-a', groupBId: 'group-b' };
    setResult('connections:pair', args, [{ id: 'pair-1' }], 'complete');
    setResult('requests:pair', args, [{ id: 'pair-request-1' }], 'unknown');

    const state = useGroupConnectionState(args);

    expect(state).toMatchObject({
      pairConnections: [{ id: 'pair-1' }],
      pairConnectionsLoading: false,
      pairConnectionRequests: [{ id: 'pair-request-1' }],
      pairConnectionRequestsLoading: true,
      allConnectionsLoading: false,
    });
  });

  it('falls back to all connections for an incomplete pair scope', () => {
    const state = useGroupConnectionState({ groupAId: 'group-a' });

    expect(state.allConnections).toEqual([]);
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toEqual({ key: 'connections:all:{}' });
  });

  it('loads a single connection and exposes both loading outcomes', () => {
    setResult('connection:id', { id: 'connection-1' }, { id: 'connection-1' }, 'unknown');
    expect(useGroupConnectionState({ connectionId: 'connection-1' })).toMatchObject({
      connection: { id: 'connection-1' },
      connectionLoading: true,
    });

    setResult('connection:id', { id: 'connection-1' }, { id: 'connection-1' }, 'complete');
    expect(useGroupConnectionState({ connectionId: 'connection-1' }).connectionLoading).toBe(false);
  });

  it('supports explicitly loading all connections together with a specific scope', () => {
    setResult('connections:all', {}, [{ id: 'all-1' }], 'complete');
    const state = useGroupConnectionState({ groupId: 'group-1', includeAll: true });

    expect(state.allConnections).toEqual([{ id: 'all-1' }]);
    expect(state.allConnectionsLoading).toBe(false);
  });

  it('supports explicitly suppressing the unscoped all query', () => {
    const state = useGroupConnectionState({ includeAll: false });

    expect(state.allConnections).toEqual([]);
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it('disables every query and loading flag when disabled', () => {
    const state = useGroupConnectionState({
      enabled: false,
      groupId: 'group-1',
      groupAId: 'group-a',
      groupBId: 'group-b',
      connectionId: 'connection-1',
      includeAll: true,
    });

    expect(mocks.useQuery.mock.calls.every(([query]) => query === undefined)).toBe(true);
    expect(state).toMatchObject({
      groupConnectionsLoading: false,
      pairConnectionsLoading: false,
      groupConnectionRequestsLoading: false,
      pairConnectionRequestsLoading: false,
      connectionLoading: false,
      allConnectionsLoading: false,
    });
  });
});
