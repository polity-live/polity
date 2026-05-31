import type { GroupRelationshipType } from '../types/network.types';

export type HierarchyRelationshipSelection = 'parent' | 'child';

interface RelationshipLike {
  group_id: string;
  related_group_id: string;
  relationship_type?: string | null;
}

export interface HierarchyRelationshipPair {
  parentGroupId: string;
  childGroupId: string;
}

export function isHierarchyRelationshipType(
  relationshipType: GroupRelationshipType
): relationshipType is HierarchyRelationshipSelection {
  return relationshipType === 'parent' || relationshipType === 'child';
}

export function getHierarchyRelationshipPair(
  relationship: RelationshipLike
): HierarchyRelationshipPair | null {
  if (relationship.relationship_type === 'sibling') {
    return null;
  }

  if (relationship.relationship_type === 'parent') {
    return {
      parentGroupId: relationship.related_group_id,
      childGroupId: relationship.group_id,
    };
  }

  return {
    parentGroupId: relationship.group_id,
    childGroupId: relationship.related_group_id,
  };
}

export function getHierarchyPairForSelection(args: {
  currentGroupId: string;
  otherGroupId: string;
  relationshipType: HierarchyRelationshipSelection;
}): HierarchyRelationshipPair {
  return args.relationshipType === 'parent'
    ? {
        parentGroupId: args.currentGroupId,
        childGroupId: args.otherGroupId,
      }
    : {
        parentGroupId: args.otherGroupId,
        childGroupId: args.currentGroupId,
      };
}

export function getStoredHierarchyRelationshipTypeForSource(
  sourceGroupId: string,
  pair: HierarchyRelationshipPair
): HierarchyRelationshipSelection {
  return sourceGroupId === pair.parentGroupId ? 'child' : 'parent';
}

export function matchesHierarchyRelationshipSelection(
  relationship: RelationshipLike,
  args: {
    currentGroupId: string;
    otherGroupId: string;
    relationshipType: HierarchyRelationshipSelection;
  }
) {
  const pair = getHierarchyRelationshipPair(relationship);
  if (!pair) {
    return false;
  }

  const expectedPair = getHierarchyPairForSelection(args);

  return (
    pair.parentGroupId === expectedPair.parentGroupId &&
    pair.childGroupId === expectedPair.childGroupId
  );
}

export function matchesRelationshipSelection(
  relationship: RelationshipLike,
  args: {
    currentGroupId: string;
    otherGroupId: string;
    relationshipType: GroupRelationshipType;
  }
) {
  if (args.relationshipType === 'sibling') {
    return (
      relationship.relationship_type === 'sibling' &&
      ((relationship.group_id === args.currentGroupId &&
        relationship.related_group_id === args.otherGroupId) ||
        (relationship.group_id === args.otherGroupId &&
          relationship.related_group_id === args.currentGroupId))
    );
  }

  return matchesHierarchyRelationshipSelection(relationship, {
    currentGroupId: args.currentGroupId,
    otherGroupId: args.otherGroupId,
    relationshipType: args.relationshipType,
  });
}

export function getRelationshipTypeForGroup(
  relationship: RelationshipLike,
  groupId: string
): GroupRelationshipType | null {
  if (relationship.relationship_type === 'sibling') {
    return relationship.group_id === groupId || relationship.related_group_id === groupId
      ? 'sibling'
      : null;
  }

  const pair = getHierarchyRelationshipPair(relationship);
  if (!pair) {
    return null;
  }

  if (pair.parentGroupId === groupId) {
    return 'parent';
  }

  if (pair.childGroupId === groupId) {
    return 'child';
  }

  return null;
}
