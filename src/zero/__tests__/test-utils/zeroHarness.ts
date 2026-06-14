import { vi, type Mock } from 'vitest';

export type QueryCall = [string, ...unknown[]];

export interface FakeQuery {
  readonly table: string;
  readonly calls: QueryCall[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => FakeQuery;
  related: (relation: string, fn?: (q: FakeQuery) => unknown) => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  start: (...args: unknown[]) => FakeQuery;
  one: () => FakeQuery;
}

interface PredicateQuery {
  where: (...args: unknown[]) => PredicateQuery;
  whereExists: (relation: string, fn: (q: PredicateQuery) => unknown) => PredicateQuery;
}

export interface QueryHarness {
  readonly zql: Record<string, FakeQuery>;
  readonly byTable: Record<string, FakeQuery[]>;
  reset: () => void;
  createQuery: (table: string) => FakeQuery;
  queriesFor: (table: string) => FakeQuery[];
  lastQuery: (table: string) => FakeQuery;
}

export function createQueryHarness(): QueryHarness {
  const state = {
    byTable: {} as Record<string, FakeQuery[]>,
  };

  function createQuery(table: string): FakeQuery {
    const query: FakeQuery = {
      table,
      calls: [],
      where: (...args: unknown[]) => {
        query.calls.push(['where', ...args]);
        return query;
      },
      whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => {
        const child = createQuery(`${table}.${relation}`);
        query.calls.push(['whereExists', relation, child.calls]);
        fn(child);
        return query;
      },
      related: (relation: string, fn?: (q: FakeQuery) => unknown) => {
        const child = createQuery(`${table}.${relation}`);
        query.calls.push(['related', relation, child.calls]);
        if (fn) fn(child);
        return query;
      },
      orderBy: (...args: unknown[]) => {
        query.calls.push(['orderBy', ...args]);
        return query;
      },
      limit: (...args: unknown[]) => {
        query.calls.push(['limit', ...args]);
        return query;
      },
      start: (...args: unknown[]) => {
        query.calls.push(['start', ...args]);
        return query;
      },
      one: () => {
        query.calls.push(['one']);
        return query;
      },
    };

    state.byTable[table] = [...(state.byTable[table] ?? []), query];
    return query;
  }

  return {
    zql: new Proxy(
      {},
      {
        get: (_target, prop) => createQuery(String(prop)),
      }
    ) as Record<string, FakeQuery>,
    byTable: state.byTable,
    reset: () => {
      for (const key of Object.keys(state.byTable)) {
        Reflect.deleteProperty(state.byTable, key);
      }
    },
    createQuery,
    queriesFor: (table: string) => state.byTable[table] ?? [],
    lastQuery: (table: string) => {
      const query = state.byTable[table]?.at(-1);
      if (!query) throw new Error(`No query captured for ${table}`);
      return query;
    },
  };
}

export function evaluatePredicate(predicate: unknown): QueryCall[] {
  const calls: QueryCall[] = [];

  const helpers = {
    cmp: (...args: unknown[]) => {
      const call: QueryCall = ['cmp', ...args];
      calls.push(call);
      return call;
    },
    exists: (relation: string, fn: (q: PredicateQuery) => unknown) => {
      const call: QueryCall = ['exists', relation];
      calls.push(call);
      fn(makeQuery(relation));
      return call;
    },
    or: (...args: unknown[]) => {
      const call: QueryCall = ['or', ...args];
      calls.push(call);
      return call;
    },
    and: (...args: unknown[]) => {
      const call: QueryCall = ['and', ...args];
      calls.push(call);
      return call;
    },
  };

  function makeQuery(queryTable: string): PredicateQuery {
    const query: PredicateQuery = {
      where: (...args: unknown[]) => {
        calls.push(['where', queryTable, ...args]);
        if (typeof args[0] === 'function') {
          args[0](helpers);
        }
        return query;
      },
      whereExists: (relation: string, fn: (q: PredicateQuery) => unknown) => {
        calls.push(['whereExists', queryTable, relation]);
        fn(makeQuery(`${queryTable}.${relation}`));
        return query;
      },
    };

    return query;
  }

  if (typeof predicate === 'function') {
    predicate(helpers);
  }

  return calls;
}

export function findCall(
  calls: readonly QueryCall[],
  method: string,
  matcher?: (call: QueryCall) => boolean
): QueryCall | undefined {
  return calls.find(call => call[0] === method && (!matcher || matcher(call)));
}

export function relatedCalls(calls: readonly QueryCall[], relation: string): QueryCall[] {
  const call = calls.find(item => item[0] === 'related' && item[1] === relation);
  if (!call) throw new Error(`No related(${relation}) call captured`);
  return call[2] as QueryCall[];
}

export interface TxHarness {
  readonly tx: {
    clientID: string;
    mutationID: number;
    reason: string;
    location: 'client' | 'server';
    run: Mock;
    mutate: Record<string, Record<string, Mock>>;
  };
  queueRunResults: (...results: unknown[]) => void;
  mutation: (table: string, operation: string) => Mock;
}

export function createTxHarness(options: { location?: 'client' | 'server' } = {}): TxHarness {
  const runResults: unknown[] = [];
  const operationMocks: Record<string, Record<string, Mock>> = {};

  function mutation(table: string, operation: string): Mock {
    operationMocks[table] ??= {};
    operationMocks[table][operation] ??= vi.fn();
    return operationMocks[table][operation];
  }

  const mutate = new Proxy(
    {},
    {
      get: (_target, table) =>
        new Proxy(
          {},
          {
            get: (_tableTarget, operation) => mutation(String(table), String(operation)),
          }
        ),
    }
  ) as Record<string, Record<string, Mock>>;

  const tx = {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location: options.location ?? 'server',
    run: vi.fn(async () => runResults.shift()),
    mutate,
  };

  return {
    tx,
    queueRunResults: (...results: unknown[]) => {
      runResults.push(...results);
    },
    mutation,
  };
}

export function createCtx(overrides: { userID?: string; email?: string } = {}) {
  return {
    userID: overrides.userID ?? 'user-1',
    email: overrides.email ?? 'user-1@example.com',
  };
}

export function createCanMock() {
  return vi.fn(async () => undefined);
}

export function installDeterministicGlobals(
  options: { now?: number; uuids?: string | string[] } = {}
) {
  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(options.now ?? 1_700_000_000_000);
  const uuidValues = Array.isArray(options.uuids)
    ? [...options.uuids]
    : [options.uuids ?? '00000000-0000-4000-8000-000000000001'];
  const fallbackUuid = uuidValues.at(-1) ?? '00000000-0000-4000-8000-000000000001';
  const uuidSpy = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockImplementation(
      () => (uuidValues.shift() ?? fallbackUuid) as ReturnType<Crypto['randomUUID']>
    );

  return {
    restore: () => {
      nowSpy.mockRestore();
      uuidSpy.mockRestore();
    },
  };
}
