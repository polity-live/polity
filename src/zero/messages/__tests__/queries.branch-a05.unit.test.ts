import { describe, expect, it, vi } from 'vitest';

interface FakeQuery {
  calls: unknown[][];
  where: (...args: any[]) => FakeQuery;
  whereExists: (...args: any[]) => FakeQuery;
  related: (...args: any[]) => FakeQuery;
  orderBy: (...args: any[]) => FakeQuery;
  limit: (...args: any[]) => FakeQuery;
  start: (...args: any[]) => FakeQuery;
  one: (...args: any[]) => FakeQuery;
}

const state = vi.hoisted(() => ({ roots: [] as any[] }));

vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../../schema', () => {
  function createQuery(): FakeQuery {
    const query = {} as FakeQuery;
    const operators = {
      cmp: (...args: any[]) => ['cmp', ...args],
      or: (...args: any[]) => ['or', ...args],
      exists: (_relation: string, callback: (child: FakeQuery) => unknown) => {
        callback(createQuery());
        return ['exists'];
      },
    };
    query.calls = [];
    query.where = (...args: any[]) => {
      query.calls.push(['where', ...args]);
      if (typeof args[0] === 'function') args[0](operators);
      return query;
    };
    query.whereExists = (...args: any[]) => {
      query.calls.push(['whereExists', ...args]);
      if (typeof args[1] === 'function') args[1](createQuery());
      return query;
    };
    query.related = (...args: any[]) => {
      query.calls.push(['related', ...args]);
      if (typeof args[1] === 'function') args[1](createQuery());
      return query;
    };
    for (const method of ['orderBy', 'limit', 'start', 'one'] as const) {
      query[method] = (...args: any[]) => {
        query.calls.push([method, ...args]);
        return query;
      };
    }
    state.roots.push(query);
    return query;
  }
  return { zql: new Proxy({}, { get: () => createQuery() }) };
});

import { messageQueries } from '../queries';

const user = { userID: 'viewer', email: 'viewer@example.test' };

function call(name: keyof typeof messageQueries, args: Record<string, unknown>, ctx = user) {
  return (messageQueries[name] as any).fn({ args, ctx });
}

describe('message queries exhaustive construction', () => {
  it('constructs all scalar, relation, window and unread queries', () => {
    call('conversations', {});
    call('unreadSummary', {});
    call('conversationById', { id: 'conversation' });
    call('conversationById', { id: 'conversation' }, { userID: 'anon', email: '' });
    call('conversationById', { id: 'conversation' }, { userID: undefined, email: '' } as any);
    call('messages', { conversation_id: 'conversation' });
    call('messageById', { id: 'message' });
    call('messagesWindow', { conversation_id: 'conversation', limit: 20 });
    call('unreadCount', { conversation_id: 'conversation' });
    call('conversationsForUnread', {});
    call('conversationsByUserWithRelations', { user_id: 'other' });
    call('conversationByGroupId', { group_id: 'group' });
    call('conversationByEventId', { event_id: 'event' });
    expect(state.roots.length).toBeGreaterThan(10);
  });

  it('covers message paging direction and optional cursor', () => {
    call('messagePage', { conversationId: 'conversation', limit: 10, start: null, dir: 'forward' });
    const backward = call('messagePage', {
      conversationId: 'conversation',
      limit: 10,
      start: { created_at: 1, id: 'message' },
      dir: 'backward',
    });
    expect(backward.calls.some((queryCall: unknown[]) => queryCall[0] === 'start')).toBe(true);
  });

  it('covers optional relation limits and every conversation-page filter', () => {
    call('conversationsWithRelations', { limit: undefined });
    const limited = call('conversationsWithRelations', { limit: 5 });
    expect(
      limited.calls.some((queryCall: unknown[]) => queryCall[0] === 'limit' && queryCall[1] === 5)
    ).toBe(true);

    for (const filter of ['all', 'direct', 'group', 'event', 'ai']) {
      call('conversationPage', {
        filter,
        query: filter === 'all' ? '' : '  search  ',
        limit: 10,
        start: filter === 'ai' ? { id: 'cursor', pinned: false, last_message_at: 1 } : null,
        dir: filter === 'event' ? 'backward' : 'forward',
      });
    }
  });
});
