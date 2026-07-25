import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = readonly [string, ...unknown[]];

interface FakeQuery {
  readonly calls: QueryCall[];
  where: (...args: unknown[]) => FakeQuery;
  related: (relation: string, fn?: (query: FakeQuery) => unknown) => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  start: (...args: unknown[]) => FakeQuery;
}

const queryState = vi.hoisted(() => ({
  conversationQueries: [] as FakeQuery[],
}));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../schema', () => {
  function createQuery(): FakeQuery {
    const query: FakeQuery = {
      calls: [],
      where: (...args: unknown[]) => {
        query.calls.push(['where', ...args]);
        return query;
      },
      related: (relation: string, fn?: (child: FakeQuery) => unknown) => {
        const child = createQuery();
        query.calls.push(['related', relation, child.calls]);
        fn?.(child);
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
    };

    queryState.conversationQueries.push(query);
    return query;
  }

  return {
    zql: new Proxy(
      {},
      {
        get: () => createQuery(),
      }
    ),
  };
});

import { messageQueries } from '../queries';

const ASSISTANT_SYSTEM_USER_ID = 'a12a0000-0000-4000-a000-000000000001';

function evaluatePredicate(predicate: unknown): QueryCall[] {
  const calls: QueryCall[] = [];
  const helpers = {
    cmp: (...args: unknown[]) => {
      calls.push(['cmp', ...args]);
      return ['cmp', ...args];
    },
    exists: (relation: string, fn: (query: FakeQuery) => unknown) => {
      const child: FakeQuery = {
        calls: [],
        where: (...args: unknown[]) => {
          calls.push(['where', relation, ...args]);
          if (typeof args[0] === 'function') args[0](helpers);
          return child;
        },
        related: () => child,
        orderBy: () => child,
        limit: () => child,
        start: () => child,
      };
      calls.push(['exists', relation]);
      fn(child);
      return ['exists', relation];
    },
    or: (...args: unknown[]) => {
      calls.push(['or', ...args]);
      return ['or', ...args];
    },
  };

  if (typeof predicate === 'function') predicate(helpers);
  return calls;
}

beforeEach(() => {
  queryState.conversationQueries.length = 0;
});

describe('messageQueries conversation AI filter', () => {
  it('includes both marked AI chats and legacy assistant-participant chats', () => {
    messageQueries.conversationPage.fn({
      args: {
        filter: 'ai',
        query: '',
        limit: 20,
        start: null,
        dir: 'forward',
      },
      ctx: { userID: 'user-1', email: 'user-1@example.com' },
    });

    const conversation = queryState.conversationQueries[0];
    const predicates = conversation.calls
      .filter(call => call[0] === 'where' && typeof call[1] === 'function')
      .map(call => evaluatePredicate(call[1]));

    expect(predicates).toContainEqual(
      expect.arrayContaining([
        ['cmp', 'assistant_for_user_id', 'user-1'],
        ['exists', 'participants'],
        ['where', 'participants', 'user_id', ASSISTANT_SYSTEM_USER_ID],
      ])
    );
  });
});

describe('messageQueries unread summary projection', () => {
  it('loads only the viewer participant and its scalar conversation row', () => {
    messageQueries.unreadSummary.fn({
      args: {},
      ctx: { userID: 'user-1', email: 'user-1@example.com' },
    });

    expect(queryState.conversationQueries[0].calls).toEqual([
      ['where', 'user_id', 'user-1'],
      ['related', 'conversation', []],
    ]);
  });

  it('denies anonymous access', () => {
    messageQueries.unreadSummary.fn({
      args: {},
      ctx: { userID: 'anon', email: '' },
    });

    expect(queryState.conversationQueries[0].calls).toEqual([
      ['where', 'id', '__unauthorized__'],
      ['related', 'conversation', []],
    ]);
  });
});
