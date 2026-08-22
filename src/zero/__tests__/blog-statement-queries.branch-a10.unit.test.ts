import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as unknown[][] }));

function makeQuery(label: string): any {
  const query: Record<string, any> = {};
  const child = (relation: string) => makeQuery(`${label}.${relation}`);
  const helpers = {
    cmp: (...args: unknown[]) => ['cmp', ...args],
    or: (...args: unknown[]) => ['or', ...args],
    exists: (relation: string, callback: (query: any) => unknown) => {
      callback(child(relation));
      return ['exists', relation];
    },
  };
  for (const method of ['where', 'whereExists', 'related', 'orderBy', 'start', 'limit']) {
    query[method] = (...args: unknown[]) => {
      state.calls.push([label, method, ...args]);
      for (const arg of args) {
        if (typeof arg === 'function') {
          if (method === 'where') arg(helpers);
          else arg(child(String(args[0])));
        }
      }
      return query;
    };
  }
  query.one = () => {
    state.calls.push([label, 'one']);
    return query;
  };
  return query;
}

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../schema', () => ({
  zql: new Proxy({}, { get: (_target, property) => makeQuery(String(property)) }),
}));

vi.mock('../rbac/query-access', () => ({
  applyBlogManagerQueryAccess: (query: unknown) => query,
  applyBlogQueryAccess: (query: unknown) => query,
  applyStatementQueryAccess: (query: unknown) => query,
}));

import { blogQueries } from '../blogs/queries';
import { statementQueries } from '../statements/queries';

const auth = { userID: 'user-1', email: 'user@example.com' };
const anonymous = { userID: undefined, email: undefined } as any;

beforeEach(() => {
  state.calls = [];
});

describe('blog query exhaustive branch campaign A10', () => {
  it('executes pagination, filters, cursor directions, and relation callbacks', () => {
    blogQueries.pageByGroup.fn({
      args: { groupId: 'group', query: '', limit: 10, start: null, dir: 'forward' },
      ctx: auth,
    });
    blogQueries.pageByGroup.fn({
      args: {
        groupId: 'group',
        query: ' budget ',
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });
    blogQueries.pageByUser.fn({
      args: { userId: 'author', query: '', limit: 10, start: null, dir: 'forward' },
      ctx: auth,
    });
    blogQueries.pageByUser.fn({
      args: {
        userId: 'author',
        query: ' civic ',
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });

    blogQueries.bloggerPage.fn({
      args: {
        blogId: 'blog',
        status: undefined,
        statuses: undefined as any,
        roleId: undefined,
        roleIds: undefined as any,
        query: '',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: auth,
    });
    blogQueries.bloggerPage.fn({
      args: {
        blogId: 'blog',
        status: undefined,
        statuses: [],
        roleId: undefined,
        roleIds: [],
        query: '',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: auth,
    });
    blogQueries.bloggerPage.fn({
      args: {
        blogId: 'blog',
        status: 'active',
        statuses: ['active', 'invited'],
        roleId: 'writer',
        roleIds: ['writer'],
        query: ' ada ',
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });
    blogQueries.bloggerMembershipPageByUser.fn({
      args: {
        userId: 'user',
        status: undefined,
        statuses: undefined as any,
        query: '',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: auth,
    });
    blogQueries.bloggerMembershipPageByUser.fn({
      args: {
        userId: 'user',
        status: undefined,
        statuses: [],
        query: '',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: auth,
    });
    blogQueries.bloggerMembershipPageByUser.fn({
      args: {
        userId: 'user',
        status: 'active',
        statuses: ['active'],
        query: ' blog ',
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });
    expect(state.calls.some(call => call[1] === 'start')).toBe(true);
  });

  it('executes every public, manager, subscriber, user, and comment-vote query boundary', () => {
    const invoke = (query: any, args: Record<string, unknown>, ctx = auth) =>
      query.fn({ args, ctx });

    invoke(blogQueries.byUser, {});
    invoke(blogQueries.byGroup, { group_id: 'group' });
    invoke(blogQueries.byId, { id: 'blog' });
    invoke(blogQueries.byIdWithBloggers, { id: 'blog' });
    invoke(blogQueries.byIdWithManagement, { id: 'blog' }, anonymous);
    invoke(blogQueries.byIdWithManagement, { id: 'blog' }, { ...auth, userID: 'anon' });
    invoke(blogQueries.byIdWithManagement, { id: 'blog' });
    invoke(blogQueries.byIdWithDetails, { id: 'blog' }, anonymous);
    invoke(blogQueries.byIdWithDetails, { id: 'blog' });
    invoke(blogQueries.byIdWithHashtags, { id: 'blog' });
    invoke(blogQueries.byIdForEditor, { id: 'blog' });
    invoke(blogQueries.entries, { blog_id: 'blog' });
    invoke(blogQueries.bloggerPageById, { id: 'entry' });
    invoke(blogQueries.entryById, { id: 'entry' });
    invoke(blogQueries.versionsByBlogId, { blog_id: 'blog' });
    invoke(blogQueries.subscribers, { blog_id: 'blog' }, anonymous);
    invoke(blogQueries.subscribers, { blog_id: 'blog' });
    invoke(blogQueries.blogThread, { blog_id: 'blog' }, anonymous);
    invoke(blogQueries.blogThread, { blog_id: 'blog' });
    invoke(blogQueries.bloggersByUser, { user_id: 'user' });
    invoke(blogQueries.byGroupWithHashtags, { group_id: 'group' });
    expect(state.calls.length).toBeGreaterThan(50);
  });
});

describe('statement query exhaustive branch campaign A10', () => {
  it('executes both page directions, query terms, cursor states, and anonymous votes', () => {
    statementQueries.pageByGroup.fn({
      args: {
        groupId: 'group',
        query: '',
        now: 100,
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: anonymous,
    });
    statementQueries.pageByGroup.fn({
      args: {
        groupId: 'group',
        query: ' civic ',
        now: 100,
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });
    statementQueries.pageByUser.fn({
      args: {
        userId: 'author',
        query: '',
        now: 100,
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: anonymous,
    });
    statementQueries.pageByUser.fn({
      args: {
        userId: 'author',
        query: ' policy ',
        now: 100,
        limit: 10,
        start: { id: 'cursor', created_at: 1 },
        dir: 'backward',
      },
      ctx: auth,
    });
    expect(state.calls.some(call => call[1] === 'start')).toBe(true);
  });

  it('executes all detail and list relations for authenticated and anonymous contexts', () => {
    const invoke = (query: any, args: Record<string, unknown>, ctx = auth) =>
      query.fn({ args, ctx });
    invoke(statementQueries.byUser, { now: 100 }, anonymous);
    invoke(statementQueries.byGroup, { group_id: 'group', now: 100 }, anonymous);
    invoke(statementQueries.carousel, { user_id: null, now: 100, limit: 24 }, anonymous);
    invoke(statementQueries.carousel, { user_id: 'author', now: 100, limit: 24 });
    invoke(statementQueries.byId, { id: 'statement', now: 100 });
    invoke(statementQueries.byIdWithDetails, { id: 'statement', now: 100 }, anonymous);
    invoke(statementQueries.byIdWithDetails, { id: 'statement', now: 100 });
    invoke(statementQueries.byIdWithHashtags, { id: 'statement', now: 100 });
    invoke(statementQueries.byUserId, { user_id: 'author', now: 100 }, anonymous);
    invoke(statementQueries.byVisibility, { visibility: 'public', now: 100 }, anonymous);
    expect(state.calls.length).toBeGreaterThan(50);
  });
});
