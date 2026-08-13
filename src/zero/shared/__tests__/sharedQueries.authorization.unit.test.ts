import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = readonly [string, ...unknown[]];

interface FakeQuery {
  readonly table: string;
  readonly calls: QueryCall[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => FakeQuery;
  related: (relation: string, fn?: (q: FakeQuery) => unknown) => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  one: () => FakeQuery;
}

const queryState = vi.hoisted(() => ({
  byTable: {} as Record<string, FakeQuery[]>,
}));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../schema', () => {
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
      one: () => {
        query.calls.push(['one']);
        return query;
      },
    };

    queryState.byTable[table] = [...(queryState.byTable[table] ?? []), query];
    return query;
  }

  return {
    zql: new Proxy(
      {},
      {
        get: (_target, prop) => createQuery(String(prop)),
      }
    ),
  };
});

import { searchQueries } from '../queries';

const ctx = { userID: 'user-1', email: 'user@example.com' };

function lastQuery(table: string): FakeQuery {
  const queries = queryState.byTable[table] ?? [];
  const query = queries.at(-1);
  if (!query) throw new Error(`No query captured for ${table}`);
  return query;
}

beforeEach(() => {
  queryState.byTable = {};
});

describe('shared search query authorization', () => {
  it('intersects spoofed user membership lookups with the authenticated user', () => {
    searchQueries.userGroupMemberships.fn({
      args: { user_id: 'attacker-user' },
      ctx,
    });

    expect(lastQuery('group_membership').calls).toEqual(
      expect.arrayContaining([
        ['where', 'user_id', 'user-1'],
        ['where', 'user_id', 'attacker-user'],
      ])
    );
  });

  it('intersects spoofed todo creator lookups and applies todo visibility access', () => {
    searchQueries.searchableTodosByCreator.fn({
      args: { user_id: 'attacker-user', limit: 20, query: 'roadmap' },
      ctx,
    });

    const calls = lastQuery('todo').calls;
    expect(calls[0][0]).toBe('where');
    expect(typeof calls[0][1]).toBe('function');
    expect(calls).toEqual(
      expect.arrayContaining([
        ['where', 'creator_id', 'user-1'],
        ['where', 'creator_id', 'attacker-user'],
        ['where', 'title', 'ILIKE', '%roadmap%'],
      ])
    );
  });

  it('filters nested todos in assignment helper queries', () => {
    searchQueries.userTodoAssignments.fn({
      args: { user_id: 'attacker-user' },
      ctx,
    });

    const relatedTodoCall = lastQuery('todo_assignment').calls.find(
      call => call[0] === 'related' && call[1] === 'todo'
    );

    expect(relatedTodoCall).toBeDefined();
    const todoCalls = relatedTodoCall?.[2] as QueryCall[];
    expect(todoCalls[0][0]).toBe('where');
    expect(typeof todoCalls[0][1]).toBe('function');
  });

  it('limits rich relations in searchable user results to self or managed parents', () => {
    searchQueries.searchableUsers.fn({
      args: { limit: 20, query: 'ada' },
      ctx,
    });

    const userCalls = lastQuery('user').calls;
    const membershipsCall = userCalls.find(
      call => call[0] === 'related' && call[1] === 'group_memberships'
    );
    const collaborationsCall = userCalls.find(
      call => call[0] === 'related' && call[1] === 'amendment_collaborations'
    );

    expect(membershipsCall).toBeDefined();
    const membershipCalls = membershipsCall?.[2] as QueryCall[];
    expect(membershipCalls[0][0]).toBe('where');
    expect(typeof membershipCalls[0][1]).toBe('function');

    expect(collaborationsCall).toBeDefined();
    const collaborationCalls = collaborationsCall?.[2] as QueryCall[];
    expect(collaborationCalls).toEqual(expect.arrayContaining([['where', 'user_id', 'user-1']]));
  });

  it('filters rich relations in searchable event results to participants or managers', () => {
    searchQueries.searchableEvents.fn({
      args: { limit: 20, query: 'assembly' },
      ctx,
    });

    const eventCalls = lastQuery('event').calls;
    const participantsCall = eventCalls.find(
      call => call[0] === 'related' && call[1] === 'participants'
    );
    const rolesCall = eventCalls.find(call => call[0] === 'related' && call[1] === 'roles');
    const agendaCall = eventCalls.find(call => call[0] === 'related' && call[1] === 'agenda_items');

    expect(participantsCall).toBeDefined();
    const participantCalls = participantsCall?.[2] as QueryCall[];
    expect(participantCalls[0][0]).toBe('where');
    expect(typeof participantCalls[0][1]).toBe('function');

    expect(rolesCall).toBeDefined();
    const roleCalls = rolesCall?.[2] as QueryCall[];
    expect(roleCalls.some(call => call[0] === 'whereExists' && call[1] === 'event')).toBe(true);

    expect(agendaCall).toBeDefined();
    const agendaCalls = agendaCall?.[2] as QueryCall[];
    expect(agendaCalls[0][0]).toBe('where');
    expect(typeof agendaCalls[0][1]).toBe('function');
  });

  it('filters todo assignment relations in searchable todo results to the caller', () => {
    searchQueries.searchableTodos.fn({
      args: { limit: 20, query: 'minutes' },
      ctx,
    });

    const todoCalls = lastQuery('todo').calls;
    const assignmentsCall = todoCalls.find(
      call => call[0] === 'related' && call[1] === 'assignments'
    );

    expect(assignmentsCall).toBeDefined();
    const assignmentCalls = assignmentsCall?.[2] as QueryCall[];
    expect(assignmentCalls).toEqual(expect.arrayContaining([['where', 'user_id', 'user-1']]));
  });
});
