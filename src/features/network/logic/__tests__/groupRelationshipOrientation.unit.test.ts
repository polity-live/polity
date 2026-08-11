import { describe, expect, it } from 'vitest';

import {
  getHierarchyPairForSelection,
  getHierarchyRelationshipPair,
  getRelationshipTypeForGroup,
  getStoredHierarchyRelationshipTypeForSource,
  isHierarchyRelationshipType,
  matchesHierarchyRelationshipSelection,
  matchesRelationshipSelection,
} from '../groupRelationshipOrientation';

const hierarchy = {
  group_id: 'parent',
  related_group_id: 'child',
  relationship_type: 'child',
  parent_group_id: 'parent',
  child_group_id: 'child',
};

describe('groupRelationshipOrientation', () => {
  it('recognizes hierarchy selections and rejects sibling selections', () => {
    expect(isHierarchyRelationshipType('parent')).toBe(true);
    expect(isHierarchyRelationshipType('child')).toBe(true);
    expect(isHierarchyRelationshipType('sibling')).toBe(false);
  });

  it('normalizes explicit, legacy, and non-hierarchy relationship pairs', () => {
    expect(getHierarchyRelationshipPair({ ...hierarchy, connection_type: 'peer' })).toBeNull();
    expect(getHierarchyRelationshipPair({ ...hierarchy, relationship_type: 'sibling' })).toBeNull();
    expect(getHierarchyRelationshipPair(hierarchy)).toEqual({
      parentGroupId: 'parent',
      childGroupId: 'child',
    });
    expect(
      getHierarchyRelationshipPair({
        group_id: 'child',
        related_group_id: 'parent',
        relationship_type: 'parent',
      })
    ).toEqual({ parentGroupId: 'parent', childGroupId: 'child' });
    expect(
      getHierarchyRelationshipPair({
        group_id: 'parent',
        related_group_id: 'child',
        relationship_type: 'child',
      })
    ).toEqual({ parentGroupId: 'parent', childGroupId: 'child' });
  });

  it('maps selections and stored source perspectives in both directions', () => {
    const parentSelection = getHierarchyPairForSelection({
      currentGroupId: 'parent',
      otherGroupId: 'child',
      relationshipType: 'parent',
    });
    const childSelection = getHierarchyPairForSelection({
      currentGroupId: 'child',
      otherGroupId: 'parent',
      relationshipType: 'child',
    });

    expect(parentSelection).toEqual({ parentGroupId: 'parent', childGroupId: 'child' });
    expect(childSelection).toEqual({ parentGroupId: 'parent', childGroupId: 'child' });
    expect(getStoredHierarchyRelationshipTypeForSource('parent', parentSelection)).toBe('child');
    expect(getStoredHierarchyRelationshipTypeForSource('child', parentSelection)).toBe('parent');
  });

  it('matches hierarchy and sibling selections without depending on endpoint order', () => {
    expect(
      matchesHierarchyRelationshipSelection(hierarchy, {
        currentGroupId: 'parent',
        otherGroupId: 'child',
        relationshipType: 'parent',
      })
    ).toBe(true);
    expect(
      matchesHierarchyRelationshipSelection(hierarchy, {
        currentGroupId: 'child',
        otherGroupId: 'parent',
        relationshipType: 'child',
      })
    ).toBe(true);
    expect(
      matchesHierarchyRelationshipSelection(
        { ...hierarchy, relationship_type: 'sibling' },
        { currentGroupId: 'parent', otherGroupId: 'child', relationshipType: 'parent' }
      )
    ).toBe(false);
    expect(
      matchesHierarchyRelationshipSelection(hierarchy, {
        currentGroupId: 'parent',
        otherGroupId: 'other',
        relationshipType: 'parent',
      })
    ).toBe(false);

    const sibling = {
      group_id: 'left',
      related_group_id: 'right',
      relationship_type: 'sibling',
    };
    expect(
      matchesRelationshipSelection(sibling, {
        currentGroupId: 'left',
        otherGroupId: 'right',
        relationshipType: 'sibling',
      })
    ).toBe(true);
    expect(
      matchesRelationshipSelection(sibling, {
        currentGroupId: 'right',
        otherGroupId: 'left',
        relationshipType: 'sibling',
      })
    ).toBe(true);
    expect(
      matchesRelationshipSelection(sibling, {
        currentGroupId: 'left',
        otherGroupId: 'missing',
        relationshipType: 'sibling',
      })
    ).toBe(false);
    expect(
      matchesRelationshipSelection(hierarchy, {
        currentGroupId: 'parent',
        otherGroupId: 'child',
        relationshipType: 'parent',
      })
    ).toBe(true);
  });

  it('derives the relationship type only for participating groups', () => {
    const sibling = {
      group_id: 'left',
      related_group_id: 'right',
      relationship_type: 'sibling',
    };
    expect(getRelationshipTypeForGroup(sibling, 'left')).toBe('sibling');
    expect(getRelationshipTypeForGroup(sibling, 'right')).toBe('sibling');
    expect(getRelationshipTypeForGroup(sibling, 'other')).toBeNull();
    expect(getRelationshipTypeForGroup(hierarchy, 'parent')).toBe('parent');
    expect(getRelationshipTypeForGroup(hierarchy, 'child')).toBe('child');
    expect(getRelationshipTypeForGroup(hierarchy, 'other')).toBeNull();
    expect(
      getRelationshipTypeForGroup({ ...hierarchy, connection_type: 'peer' }, 'parent')
    ).toBeNull();
  });
});
