import { describe, expect, it } from 'vitest';
import {
  buildDelegateAllocationBucketRows,
  buildOpenGroupAllocations,
} from '../delegate-allocation-reconcile';

const rootGroup = { id: 'root', name: 'Root', group_type: 'hierarchical' };
const districtA = { id: 'district-a', name: 'District A', group_type: 'hierarchical' };
const districtB = { id: 'district-b', name: 'District B', group_type: 'hierarchical' };
const branchA1 = { id: 'branch-a-1', name: 'Branch A1', group_type: 'base' };
const branchA2 = { id: 'branch-a-2', name: 'Branch A2', group_type: 'base' };
const branchB1 = { id: 'branch-b-1', name: 'Branch B1', group_type: 'base' };

function hierarchyRelationship(parent: { id: string }, child: { id: string }) {
  return {
    id: `${parent.id}-${child.id}`,
    group_id: parent.id,
    related_group_id: child.id,
    parent_group_id: parent.id,
    child_group_id: child.id,
    relationship_type: 'child',
    connection_type: 'hierarchy',
    status: 'active',
    with_right: 'passiveVotingRight',
    grant_id: null,
    group: parent,
    related_group: child,
  };
}

const relationships = [
  hierarchyRelationship(rootGroup, districtA),
  hierarchyRelationship(rootGroup, districtB),
  hierarchyRelationship(districtA, branchA1),
  hierarchyRelationship(districtA, branchA2),
  hierarchyRelationship(districtB, branchB1),
];

function membership(
  id: string,
  group: { id: string; name: string; group_type: string },
  userId: string,
  overrides: Partial<{
    group_id: string;
    source_group_id: string | null;
    source_group: { id: string; name: string; group_type: string } | null;
  }> = {}
) {
  return {
    id,
    group_id: overrides.group_id ?? group.id,
    source_group_id: overrides.source_group_id ?? null,
    group,
    source_group: overrides.source_group ?? null,
    user_id: userId,
    user: { id: userId },
    status: 'active',
    roles: [],
    role: null,
  };
}

describe('delegate allocation reconciliation helpers', () => {
  it('builds subgroup buckets directly from hierarchy base memberships', () => {
    const rows = buildDelegateAllocationBucketRows({
      targetGroup: rootGroup,
      relationships,
      targetMemberships: [],
      hierarchyBaseMemberships: [
        membership('m-1', branchA1, 'user-1'),
        membership('m-2', branchA2, 'user-2'),
        membership('m-3', branchB1, 'user-3'),
      ],
      rootMemberships: [],
    } as any);

    expect(rows.sort((left, right) => left.partGroupId.localeCompare(right.partGroupId))).toEqual([
      { partGroupId: 'district-a', memberCount: 2 },
      { partGroupId: 'district-b', memberCount: 1 },
    ]);
  });

  it('does not double-count hierarchy members that are already materialized on the target group', () => {
    const rows = buildDelegateAllocationBucketRows({
      targetGroup: rootGroup,
      relationships,
      targetMemberships: [
        membership('materialized-1', rootGroup, 'user-1', {
          group_id: rootGroup.id,
          source_group_id: branchA1.id,
          source_group: branchA1,
        }),
      ],
      hierarchyBaseMemberships: [membership('base-1', branchA1, 'user-1')],
      rootMemberships: [],
    } as any);

    expect(rows).toEqual([{ partGroupId: 'district-a', memberCount: 1 }]);
  });

  it('keeps confirmed delegate seats locked out of dynamic open allocation', () => {
    const openSeatCounts = buildOpenGroupAllocations({
      bucketRows: [
        { partGroupId: 'district-a', memberCount: 100 },
        { partGroupId: 'district-b', memberCount: 1 },
      ],
      lockedSeatCountsByGroupId: new Map([['district-a', 2]]),
      totalSeatCount: 4,
    });

    expect([...openSeatCounts.entries()]).toEqual([['district-b', 2]]);
  });
});
