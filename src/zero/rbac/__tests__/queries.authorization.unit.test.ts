import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => {
  vi.resetModules();
});

async function loadRbacQueries() {
  const harness = createQueryHarness();
  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({
    zql: harness.zql,
  }));
  const mod = await import('../queries');
  return { harness, rbacQueries: mod.rbacQueries };
}

describe('viewer-scoped RBAC queries', () => {
  it('emits each viewer constraint only once', async () => {
    const { harness, rbacQueries } = await loadRbacQueries();
    const ctx = { userID: 'user-1', email: 'person@example.test' };

    rbacQueries.membershipPermissions.fn({ args: { userId: 'user-1' }, ctx });
    expect(
      harness
        .lastQuery('group_membership')
        .calls.filter(call => call[0] === 'where' && call[1] === 'user_id')
    ).toEqual([['where', 'user_id', 'user-1']]);

    harness.reset();
    rbacQueries.ownedGroupPermissions.fn({ args: { userId: 'user-1' }, ctx });
    expect(harness.lastQuery('group').calls).toEqual([['where', 'owner_id', 'user-1']]);
  });

  it('continues to deny spoofed and anonymous user scopes', async () => {
    const { harness, rbacQueries } = await loadRbacQueries();

    rbacQueries.membershipPermissions.fn({
      args: { userId: 'other-user' },
      ctx: { userID: 'user-1', email: 'person@example.test' },
    });
    expect(harness.lastQuery('group_membership').calls).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);

    harness.reset();
    rbacQueries.guestPermissions.fn({
      args: { userId: 'anon' },
      ctx: { userID: 'anon', email: '' },
    });
    expect(harness.lastQuery('group_guest_access').calls).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);
  });

  it('builds argumentless projections from ctx without target hydration', async () => {
    const { harness, rbacQueries } = await loadRbacQueries();
    const ctx = { userID: 'user-1', email: 'person@example.test' };

    rbacQueries.viewerMemberships.fn({ args: {}, ctx });
    const membershipCalls = harness.lastQuery('group_membership').calls;
    expect(membershipCalls).toContainEqual(['where', 'user_id', 'user-1']);
    expect(membershipCalls).not.toContainEqual(['related', 'group', undefined]);

    harness.reset();
    rbacQueries.viewerParticipations.fn({ args: {}, ctx });
    expect(harness.lastQuery('event_participant').calls).toContainEqual([
      'where',
      'user_id',
      'user-1',
    ]);
  });
});
