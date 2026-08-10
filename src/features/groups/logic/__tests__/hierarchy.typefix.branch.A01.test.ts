import { beforeEach, describe, expect, it, vi } from 'vitest';

const orientation = vi.hoisted(() => ({
  getHierarchyRelationshipPair: vi.fn(),
}));

vi.mock('@/features/network/logic/groupRelationshipOrientation', () => ({
  getHierarchyRelationshipPair: orientation.getHierarchyRelationshipPair,
}));

import {
  collectPathMapForBaseGroup,
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  resolveBaseGroupMembers,
  resolveChildBaseGroups,
  resolveHierarchicalAncestors,
  type HierarchyRelationshipRow,
} from '../hierarchy';

const relationship: HierarchyRelationshipRow = {
  id: 'parent-child',
  group_id: 'parent',
  related_group_id: 'child',
  parent_group_id: 'parent',
  child_group_id: 'child',
  relationship_type: null,
  connection_type: 'hierarchy',
  with_right: null,
  status: 'active',
};

function returnPairThenMissing() {
  orientation.getHierarchyRelationshipPair
    .mockReturnValueOnce({ parentGroupId: 'parent', childGroupId: 'child' })
    .mockReturnValueOnce(null);
}

describe('hierarchy defensive orientation guards', () => {
  beforeEach(() => {
    orientation.getHierarchyRelationshipPair.mockReset();
  });

  it('skips an edge if orientation becomes unavailable after active-edge filtering', () => {
    returnPairThenMissing();
    expect(resolveHierarchicalAncestors('child', [relationship])).toEqual([]);

    returnPairThenMissing();
    expect(resolveBaseGroupMembers('parent', [relationship], [])).toEqual([]);

    returnPairThenMissing();
    expect(resolveChildBaseGroups('parent', [relationship])).toEqual([]);
  });

  it('keeps conflict and duplicate-path analysis safe when a filtered edge loses orientation', () => {
    returnPairThenMissing();
    expect(detectLinkConflicts('parent', 'new-child', [], [], [relationship])).toEqual([]);

    returnPairThenMissing();
    expect(collectPathMapForBaseGroup('child', [relationship])).toEqual(new Map());

    returnPairThenMissing();
    expect(detectDuplicateHierarchyPaths([relationship])).toEqual([]);
  });
});
