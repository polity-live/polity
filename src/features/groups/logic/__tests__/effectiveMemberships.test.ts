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
});
