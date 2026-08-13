import { describe, expect, it } from 'vitest';

import {
  countDistinctMembershipUsers,
  selectMaterializedHierarchicalMemberships,
} from '../effectiveMemberships';

const h1 = { id: 'H1', name: 'H1', group_type: 'hierarchical' };
const b2 = { id: 'B2', name: 'B2', group_type: 'base' };

function relationship(parentGroupId: string, childGroupId: string) {
  return {
    id: `${parentGroupId}-${childGroupId}`,
    group_id: parentGroupId,
    related_group_id: childGroupId,
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    relationship_type: 'child' as const,
    connection_type: 'hierarchy' as const,
    with_right: null,
    status: 'active',
  };
}

function membership(
  id: string,
  overrides: Partial<{
    user_id: string;
    group_id: string;
    status: string;
    source: string | null;
    source_group_id: string | null;
    source_group: typeof b2 | null;
  }> = {}
) {
  const userId = overrides.user_id ?? `user-${id}`;

  return {
    id,
    user_id: userId,
    user: { id: userId },
    group_id: overrides.group_id ?? 'B2',
    group: overrides.group_id === 'H1' ? h1 : b2,
    status: overrides.status ?? 'active',
    source: overrides.source ?? 'direct',
    source_group_id: overrides.source_group_id ?? null,
    source_group: overrides.source_group ?? null,
    roles: [],
    role: null,
  };
}

describe('effective hierarchy memberships', () => {
  it('uses materialized parent memberships and does not synthesize effective rows', () => {
    const rows = selectMaterializedHierarchicalMemberships({
      targetGroup: h1,
      relationships: [relationship('H1', 'B2')],
      memberships: [
        membership('active-b2', { user_id: 'u1', group_id: 'B2' }),
        membership('pending-b2', {
          user_id: 'u2',
          group_id: 'B2',
          status: 'requested',
        }),
        membership('derived-h1', {
          user_id: 'u3',
          group_id: 'H1',
          source: 'derived',
          source_group_id: 'B2',
          source_group: b2,
        }),
        membership('duplicate-direct-b2', { user_id: 'u3', group_id: 'B2' }),
      ],
    });

    expect(rows.map(row => row.user_id)).toEqual(['u3']);
    expect(rows.find(row => row.user_id === 'u1')).toBeUndefined();
    expect(rows.find(row => row.user_id === 'u2')).toBeUndefined();
    expect(rows.some(row => row.id.startsWith('effective:'))).toBe(false);
    expect(countDistinctMembershipUsers(rows)).toBe(1);
  });

  it('returns no rows for a target without an identity', () => {
    expect(
      selectMaterializedHierarchicalMemberships({
        targetGroup: { id: '', name: 'Missing' },
        relationships: [],
        memberships: [membership('active', { group_id: 'H1' })],
      })
    ).toEqual([]);
  });

  it('accepts every active status spelling and active board membership', () => {
    const rows = selectMaterializedHierarchicalMemberships({
      targetGroup: h1,
      relationships: [],
      memberships: [
        membership('active', { group_id: 'H1', status: 'ACTIVE' }),
        membership('member', { group_id: 'H1', status: 'member' }),
        membership('admin', { group_id: 'H1', status: 'admin' }),
        {
          ...membership('board', { group_id: 'H1', status: 'requested' }),
          role: { id: 'board-role', name: 'Board Member' },
        },
        {
          ...membership('not-board', { group_id: 'H1', status: 'requested' }),
          role: { id: 'other-role', name: 'Other' },
        },
        {
          ...membership('missing-status', { group_id: 'H1' }),
          status: null,
          role: null,
        },
      ],
    });

    expect(rows.map(row => row.id)).toEqual(['active', 'member', 'admin', 'board']);
  });

  it('prefers materialized derived rows and then direct or legacy rows per user', () => {
    const rows = selectMaterializedHierarchicalMemberships({
      targetGroup: h1,
      relationships: [],
      memberships: [
        membership('other-source', {
          user_id: 'u1',
          group_id: 'H1',
          source: 'imported',
        }),
        membership('direct', { user_id: 'u1', group_id: 'H1', source: 'direct' }),
        membership('derived', { user_id: 'u1', group_id: 'H1', source: 'derived' }),
        {
          ...membership('legacy', { user_id: 'u2', group_id: 'H1' }),
          source: null,
        },
        membership('imported', { user_id: 'u3', group_id: 'H1', source: 'imported' }),
      ],
    });

    expect(rows.map(row => row.id)).toEqual(['derived', 'legacy', 'imported']);
  });

  it('drops memberships without a user key and counts distinct nested and scalar user ids', () => {
    const withoutUser = {
      ...membership('without-user', { group_id: 'H1' }),
      user_id: null,
      user: null,
    };
    const rows = selectMaterializedHierarchicalMemberships({
      targetGroup: h1,
      relationships: [],
      memberships: [withoutUser],
    });

    expect(rows).toEqual([]);
    expect(
      countDistinctMembershipUsers([
        { user: { id: 'nested' }, user_id: 'ignored' },
        { user: null, user_id: 'scalar' },
        { user: { id: 'nested' }, user_id: null },
        { user: null, user_id: null },
      ])
    ).toBe(2);
  });
});
