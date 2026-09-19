import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness, evaluatePredicate } from '../../__tests__/test-utils/zeroHarness';
vi.mock('@rocicorp/zero', () => ({ defineQuery: (_schema: unknown, fn: unknown) => ({ fn }) }));
const io = vi.hoisted(() => ({ zql: {} as any }));
vi.mock('../../schema', () => ({ zql: new Proxy({}, { get: (_target, key) => io.zql[key] }) }));
import { studioQueries } from '../queries';
let harness: ReturnType<typeof createQueryHarness>;
beforeEach(() => {
  harness = createQueryHarness();
  io.zql = harness.zql;
});
function access(table: string) {
  const call = harness
    .lastQuery(table)
    .calls.find(c => c[0] === 'where' && typeof c[1] === 'function');
  return evaluatePredicate(call?.[1]);
}
describe('Studio Zero visibility projections', () => {
  it.each([null, 'group'])(
    'scopes lists to the requested workspace (%s) and requires owner or active group membership',
    groupId => {
      studioQueries.list.fn({ args: { groupId }, ctx: { userID: 'alice', email: '' } });
      expect(harness.lastQuery('studio_project').calls).toEqual(
        expect.arrayContaining([
          ['where', 'group_id', groupId === null ? 'IS' : '=', groupId],
          ['orderBy', 'updated_at', 'desc'],
          ['limit', 100],
        ])
      );
      const rules = access('studio_project');
      expect(rules).toContainEqual([
        'and',
        ['cmp', 'group_id', 'IS', null],
        ['cmp', 'owner_id', 'alice'],
      ]);
      expect(rules).toContainEqual([
        'where',
        'memberships',
        'status',
        'IN',
        ['active', 'member', 'admin'],
      ]);
      expect(rules).toContainEqual(['where', 'memberships', 'user_id', 'alice']);
      expect(rules.some(r => JSON.stringify(r).includes('public'))).toBe(false);
    }
  );
  it.each([undefined, null, 'anon', ''])(
    'maps unauthenticated identity %s to an impossible owner, including exports',
    userID => {
      const ctx = { userID, email: '' } as any;
      studioQueries.project.fn({ args: { id: 'private' }, ctx });
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['where', 'id', 'private']);
      expect(harness.lastQuery('studio_project').calls).toContainEqual(['one']);
      expect(access('studio_project')).toContainEqual([
        'cmp',
        'owner_id',
        '00000000-0000-0000-0000-000000000000',
      ]);
      studioQueries.exports.fn({ args: { projectId: 'private' }, ctx });
      expect(access('studio_export.project')).toContainEqual([
        'where',
        'memberships',
        'user_id',
        '00000000-0000-0000-0000-000000000000',
      ]);
    }
  );
  it('protects each export through its parent project and caps the recent job list', () => {
    studioQueries.exports.fn({
      args: { projectId: 'private' },
      ctx: { userID: 'alice', email: '' },
    });
    expect(harness.lastQuery('studio_export').calls).toEqual(
      expect.arrayContaining([
        ['where', 'project_id', 'private'],
        ['orderBy', 'created_at', 'desc'],
        ['limit', 25],
      ])
    );
    const rules = access('studio_export.project');
    expect(rules).toContainEqual([
      'and',
      ['cmp', 'group_id', 'IS', null],
      ['cmp', 'owner_id', 'alice'],
    ]);
    expect(rules).toContainEqual(['where', 'memberships', 'user_id', 'alice']);
    expect(rules).toContainEqual([
      'where',
      'memberships',
      'status',
      'IN',
      ['active', 'member', 'admin'],
    ]);
  });
});
