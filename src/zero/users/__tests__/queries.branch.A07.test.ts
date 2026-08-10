import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ access: vi.fn(), calls: [] as [string, unknown[]][] }));

vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
vi.mock('../../rbac/query-access', () => {
  const apply =
    (name: string) =>
    (query: unknown, ...args: unknown[]) => {
      mocks.access(name, ...args);
      return query;
    };
  return {
    applyAmendmentQueryAccess: apply('amendment'),
    applyBlogQueryAccess: apply('blog'),
    applyEventQueryAccess: apply('event'),
    applyGroupMembershipSelfOrManagerQueryAccess: apply('membership'),
    applyGroupQueryAccess: apply('group'),
    applyStatementQueryAccess: apply('statement'),
    applyUserQueryAccess: apply('user'),
    applyVoteQueryAccess: apply('vote'),
  };
});
vi.mock('../../schema', () => {
  function query(label: string): any {
    const api: Record<string, any> = {};
    for (const method of ['where', 'orderBy']) {
      api[method] = (...args: unknown[]) => {
        mocks.calls.push([`${label}.${method}`, args]);
        return api;
      };
    }
    api.one = () => {
      mocks.calls.push([`${label}.one`, []]);
      return api;
    };
    for (const method of ['related', 'whereExists']) {
      api[method] = (relation: string, callback: (q: unknown) => unknown) => {
        mocks.calls.push([`${label}.${method}`, [relation]]);
        if (typeof callback === 'function') callback(query(`${label}.${relation}`));
        return api;
      };
    }
    return api;
  }
  return { zql: new Proxy({}, { get: (_target, key) => query(String(key)) }) };
});

import { userQueries } from '../queries';

const run = (
  entry: keyof typeof userQueries,
  args: Record<string, unknown> = {},
  userID: string | undefined = 'u1'
) => (userQueries[entry] as any).fn({ args, ctx: { userID } });

describe('user query branches A07', () => {
  it('executes every simple and list query', () => {
    run('current');
    run('byId', { id: 'u2' });
    run('byHandle', { handle: 'ada' });
    run('search', { query: 'ad' });
    run('publicUsers');
    run('followers', { userId: 'u2' });
    run('following', { userId: 'u2' });
    run('wikiProfile', { id: 'u2', now: 1 });
    run('allUsers');
    run('byIds', { ids: ['u1', 'u2'] });
    expect(mocks.access).toHaveBeenCalled();
    expect(mocks.calls.some(([name]) => name.endsWith('.one'))).toBe(true);
  });

  it('builds full profiles for owner/non-owner and authenticated/anonymous callers with legacy/current time', () => {
    run('fullProfile', { id: 'u1', now: 99 }, 'u1');
    run('fullProfile', { id: 'u2' }, 'u1');
    run('fullProfile', { id: 'u2' }, null as never);
    const whereValues = mocks.calls
      .filter(([name]) => name.endsWith('.where'))
      .flatMap(([, args]) => args);
    expect(whereValues).toContain('__private__');
    expect(whereValues).toContain('__anon__');
    expect(whereValues).toContain('u1');
  });

  it('builds membership profiles for owner and non-owner and searchable users for auth states', () => {
    run('withGroupMemberships', { id: 'u1' }, 'u1');
    run('withGroupMemberships', { id: 'u2' }, 'u1');
    run('searchableUsers', {}, 'u1');
    run('searchableUsers', {}, null as never);
    expect(mocks.access).toHaveBeenCalledWith('membership', 'u1');
  });
});
