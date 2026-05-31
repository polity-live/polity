import type {
  GroupRelationshipType,
  NormalizedGroupRelationship,
  NetworkGroupEntity,
} from '../types/network.types';
import {
  getHierarchyRelationshipPair,
  matchesRelationshipSelection,
} from './groupRelationshipOrientation';

export type NetworkRelationshipKind = 'active' | 'incoming' | 'outgoing';

export function isActiveGroupRelationshipStatus(status: string | null | undefined): boolean {
  return status == null || status === 'active' || status === 'accepted';
}

export function isRequestGroupRelationshipStatus(status: string | null | undefined): boolean {
  return status === 'requested' || status === 'pending';
}

export function isVisibleGroupRelationshipStatus(status: string | null | undefined): boolean {
  return isActiveGroupRelationshipStatus(status) || isRequestGroupRelationshipStatus(status);
}

export function isAcceptedSiblingRelationship(
  relationship: Pick<NormalizedGroupRelationship, 'relationship_type' | 'status'>
): boolean {
  return (
    relationship.relationship_type === 'sibling' &&
    isActiveGroupRelationshipStatus(relationship.status)
  );
}

export function getAcceptedSiblingGroups(
  relationships: NormalizedGroupRelationship[],
  currentGroupId: string
): NetworkGroupEntity[] {
  const siblingGroups = new Map<string, NetworkGroupEntity>();

  relationships.forEach(relationship => {
    if (!isAcceptedSiblingRelationship(relationship)) {
      return;
    }

    const siblingEntity =
      relationship.group?.id === currentGroupId
        ? relationship.related_group
        : relationship.related_group?.id === currentGroupId
          ? relationship.group
          : null;

    if (!siblingEntity || siblingGroups.has(siblingEntity.id)) {
      return;
    }

    siblingGroups.set(siblingEntity.id, siblingEntity);
  });

  return Array.from(siblingGroups.values());
}

export function getGroupRelationshipKind(
  relationship: NormalizedGroupRelationship,
  currentGroupId: string
): NetworkRelationshipKind | null {
  if (isActiveGroupRelationshipStatus(relationship.status)) {
    return 'active';
  }

  if (!isRequestGroupRelationshipStatus(relationship.status)) {
    return null;
  }

  const touchesCurrentGroup =
    relationship.group_id === currentGroupId || relationship.related_group_id === currentGroupId;

  if (!touchesCurrentGroup) {
    return null;
  }

  return relationship.initiator_group_id === currentGroupId ? 'outgoing' : 'incoming';
}

export type GroupRelationshipRightDisplayStatus = 'accepted' | 'incoming' | 'outgoing';

export function getGroupRelationshipRightDisplayStatus(
  relationship: Pick<NormalizedGroupRelationship, 'status' | 'initiator_group_id'>,
  currentGroupId: string
): GroupRelationshipRightDisplayStatus | null {
  if (isActiveGroupRelationshipStatus(relationship.status)) {
    return 'accepted';
  }

  if (!isRequestGroupRelationshipStatus(relationship.status)) {
    return null;
  }

  return relationship.initiator_group_id === currentGroupId ? 'outgoing' : 'incoming';
}

export function buildExistingRightStatusesForDirection(
  relationships: NormalizedGroupRelationship[],
  {
    currentGroupId,
    otherGroupId,
    relationshipType,
  }: {
    currentGroupId: string;
    otherGroupId: string;
    relationshipType: GroupRelationshipType;
  }
): ReadonlyMap<string, GroupRelationshipRightDisplayStatus> {
  const statuses = new Map<string, GroupRelationshipRightDisplayStatus>();

  relationships
    .filter(rel => {
      return matchesRelationshipSelection(rel, {
        currentGroupId,
        otherGroupId,
        relationshipType,
      });
    })
    .forEach(rel => {
      const right = rel.with_right;
      const status = getGroupRelationshipRightDisplayStatus(rel, currentGroupId);

      if (!right || !status) {
        return;
      }

      const isRequest = status === 'incoming' || status === 'outgoing';

      if (isRequest || !statuses.has(right)) {
        statuses.set(right, status);
      }
    });

  return statuses;
}

function getRelationshipGroupEntity(
  relationship: NormalizedGroupRelationship,
  groupId: string
): NetworkGroupEntity | null {
  if (relationship.group?.id === groupId) {
    return relationship.group;
  }

  if (relationship.related_group?.id === groupId) {
    return relationship.related_group;
  }

  return null;
}

function mergeRightRelationshipKind(
  existingKind: NetworkRelationshipKind | undefined,
  nextKind: NetworkRelationshipKind | null
): NetworkRelationshipKind | undefined {
  if (!nextKind) {
    return existingKind;
  }

  if (!existingKind) {
    return nextKind;
  }

  if (existingKind === 'active' || nextKind === 'active') {
    return 'active';
  }

  return existingKind;
}

function applyRelationshipToEntry(
  entry: RelationshipEntry,
  relationship: NormalizedGroupRelationship,
  currentGroupId: string
): void {
  const rightValue = relationship.with_right ?? '';

  if (!entry.rights.includes(rightValue)) {
    entry.rights.push(rightValue);
  }

  const relationshipKind = getGroupRelationshipKind(relationship, currentGroupId);

  if (relationshipKind && !entry.relationshipKinds.includes(relationshipKind)) {
    entry.relationshipKinds.push(relationshipKind);
  }

  const mergedRightKind = mergeRightRelationshipKind(
    entry.rightRelationshipKinds[rightValue],
    relationshipKind
  );

  if (mergedRightKind) {
    entry.rightRelationshipKinds[rightValue] = mergedRightKind;
  }
}

export interface RelationshipEntry {
  group: NetworkGroupEntity;
  rights: string[];
  relationshipKinds: NetworkRelationshipKind[];
  rightRelationshipKinds: Record<string, NetworkRelationshipKind>;
  level?: number;
  childId?: string;
  parentId?: string;
}

export interface RelationshipResult {
  parents: RelationshipEntry[];
  children: RelationshipEntry[];
}

export type MixedRelationshipBranch = 'parent' | 'child' | 'root-sibling';

export interface SiblingAttachmentEntry extends RelationshipEntry {
  anchorId: string;
  branch: MixedRelationshipBranch;
}

export interface MixedRelationshipResult {
  parents: RelationshipEntry[];
  children: RelationshipEntry[];
  siblingAttachments: SiblingAttachmentEntry[];
}

type TraversalPlacementBranch = MixedRelationshipBranch | 'root';
type TraversalPlacementType = 'root' | 'hierarchy' | 'sibling';

interface TraversalPlacement {
  placementType: TraversalPlacementType;
  branch: TraversalPlacementBranch;
  level: number;
  anchorId?: string;
  hierarchyConnectionId?: string;
}

interface TraversalStep {
  nextGroupId: string;
  nextGroup: NetworkGroupEntity;
  relationship: NormalizedGroupRelationship;
  stepType: 'parent' | 'child' | 'sibling';
}

function isSamePlacement(left: TraversalPlacement, right: TraversalPlacement) {
  return (
    left.placementType === right.placementType &&
    left.branch === right.branch &&
    left.level === right.level &&
    left.anchorId === right.anchorId &&
    left.hierarchyConnectionId === right.hierarchyConnectionId
  );
}

function getPlacementPriority(placement: TraversalPlacement) {
  if (placement.placementType === 'hierarchy') {
    return 0;
  }

  if (placement.branch === 'root-sibling') {
    return 1;
  }

  if (placement.placementType === 'sibling') {
    return 2;
  }

  return -1;
}

function isBetterPlacement(next: TraversalPlacement, existing: TraversalPlacement) {
  if (next.level !== existing.level) {
    return next.level < existing.level;
  }

  return getPlacementPriority(next) < getPlacementPriority(existing);
}

function createHierarchyEntry(
  group: NetworkGroupEntity,
  placement: TraversalPlacement
): RelationshipEntry | null {
  if (
    placement.placementType !== 'hierarchy' ||
    (placement.branch !== 'parent' && placement.branch !== 'child')
  ) {
    return null;
  }

  return {
    group,
    rights: [],
    relationshipKinds: [],
    rightRelationshipKinds: {},
    level: placement.level,
    childId: placement.branch === 'parent' ? placement.hierarchyConnectionId : undefined,
    parentId: placement.branch === 'child' ? placement.hierarchyConnectionId : undefined,
  };
}

function createSiblingAttachmentEntry(
  group: NetworkGroupEntity,
  placement: TraversalPlacement
): SiblingAttachmentEntry | null {
  if (placement.placementType !== 'sibling' || !placement.anchorId || placement.branch === 'root') {
    return null;
  }

  return {
    group,
    rights: [],
    relationshipKinds: [],
    rightRelationshipKinds: {},
    level: placement.level,
    anchorId: placement.anchorId,
    branch: placement.branch,
  };
}

function pushTraversalStep(
  adjacency: Map<string, TraversalStep[]>,
  currentGroupId: string,
  step: TraversalStep
) {
  const steps = adjacency.get(currentGroupId) ?? [];
  steps.push(step);
  if (!adjacency.has(currentGroupId)) {
    adjacency.set(currentGroupId, steps);
  }
}

/**
 * Build direct (one-level) parent/child relationships for a target group.
 */
export function buildDirectRelationships(
  relationships: NormalizedGroupRelationship[],
  targetGroupId: string,
  filterRight?: string,
  currentGroupId: string = targetGroupId
): RelationshipResult {
  const parentsMap = new Map<string, RelationshipEntry>();
  const childrenMap = new Map<string, RelationshipEntry>();

  relationships.forEach(rel => {
    if (filterRight && (rel.with_right ?? '') !== filterRight) {
      return;
    }

    const pair = getHierarchyRelationshipPair(rel);
    if (!pair) {
      return;
    }

    if (pair.childGroupId === targetGroupId) {
      const parentEntity = getRelationshipGroupEntity(rel, pair.parentGroupId);
      if (!parentEntity) {
        return;
      }
      const parentId = parentEntity.id;
      if (!parentsMap.has(parentId)) {
        parentsMap.set(parentId, {
          group: parentEntity,
          rights: [],
          relationshipKinds: [],
          rightRelationshipKinds: {},
        });
      }
      const parentEntry = parentsMap.get(parentId);
      if (parentEntry) {
        applyRelationshipToEntry(parentEntry, rel, currentGroupId);
      }
    }

    if (pair.parentGroupId === targetGroupId) {
      const childEntity = getRelationshipGroupEntity(rel, pair.childGroupId);
      if (!childEntity) {
        return;
      }
      const childId = childEntity.id;
      if (!childrenMap.has(childId)) {
        childrenMap.set(childId, {
          group: childEntity,
          rights: [],
          relationshipKinds: [],
          rightRelationshipKinds: {},
        });
      }
      const childEntry = childrenMap.get(childId);
      if (childEntry) {
        applyRelationshipToEntry(childEntry, rel, currentGroupId);
      }
    }
  });

  return {
    parents: Array.from(parentsMap.values()),
    children: Array.from(childrenMap.values()),
  };
}

/**
 * Build indirect (recursive, per-right-type chain) parent/child relationships for a target group.
 */
export function buildIndirectRelationships(
  relationships: NormalizedGroupRelationship[],
  targetGroupId: string,
  filterRight?: string,
  currentGroupId: string = targetGroupId
): RelationshipResult {
  const parentsMap = new Map<string, RelationshipEntry>();
  const childrenMap = new Map<string, RelationshipEntry>();

  const directRels = buildDirectRelationships(
    relationships,
    targetGroupId,
    filterRight,
    currentGroupId
  );

  // For parents: Add direct parents first (level 1), then follow chains for each right type
  directRels.parents.forEach(parent => {
    parentsMap.set(parent.group.id, {
      group: parent.group,
      rights: [...parent.rights],
      relationshipKinds: [...parent.relationshipKinds],
      rightRelationshipKinds: { ...parent.rightRelationshipKinds },
      level: 1,
      childId: targetGroupId,
    });

    parent.rights.forEach(right => {
      const visited = new Set<string>([targetGroupId, parent.group.id]);

      const findParentsForRight = (id: string, level: number) => {
        relationships.forEach(rel => {
          if (filterRight && (rel.with_right ?? '') !== filterRight) return;
          const pair = getHierarchyRelationshipPair(rel);
          if (!pair) return;

          if (
            pair.childGroupId === id &&
            (rel.with_right ?? '') === right &&
            !visited.has(pair.parentGroupId)
          ) {
            const parentId = pair.parentGroupId;
            const parentEntity = getRelationshipGroupEntity(rel, parentId);
            if (!parentEntity) {
              return;
            }
            visited.add(parentId);

            if (!parentsMap.has(parentId)) {
              parentsMap.set(parentId, {
                group: parentEntity,
                rights: [],
                relationshipKinds: [],
                rightRelationshipKinds: {},
                level,
                childId: id,
              });
            }
            const entry = parentsMap.get(parentId);
            if (!entry) {
              return;
            }

            applyRelationshipToEntry(entry, rel, currentGroupId);

            findParentsForRight(parentId, level + 1);
          }
        });
      };

      findParentsForRight(parent.group.id, 2);
    });
  });

  // For children: Add direct children first (level 1), then follow chains for each right type
  directRels.children.forEach(child => {
    childrenMap.set(child.group.id, {
      group: child.group,
      rights: [...child.rights],
      relationshipKinds: [...child.relationshipKinds],
      rightRelationshipKinds: { ...child.rightRelationshipKinds },
      level: 1,
      parentId: targetGroupId,
    });

    child.rights.forEach(right => {
      const visited = new Set<string>([targetGroupId, child.group.id]);

      const findChildrenForRight = (id: string, level: number, currentParentId: string) => {
        relationships.forEach(rel => {
          if (filterRight && (rel.with_right ?? '') !== filterRight) return;
          const pair = getHierarchyRelationshipPair(rel);
          if (!pair) return;

          if (
            pair.parentGroupId === id &&
            (rel.with_right ?? '') === right &&
            !visited.has(pair.childGroupId)
          ) {
            const childId = pair.childGroupId;
            const childEntity = getRelationshipGroupEntity(rel, childId);
            if (!childEntity) {
              return;
            }
            visited.add(childId);

            if (!childrenMap.has(childId)) {
              childrenMap.set(childId, {
                group: childEntity,
                rights: [],
                relationshipKinds: [],
                rightRelationshipKinds: {},
                level,
                parentId: currentParentId,
              });
            }
            const entry = childrenMap.get(childId);
            if (!entry) {
              return;
            }

            applyRelationshipToEntry(entry, rel, currentGroupId);

            findChildrenForRight(childId, level + 1, childId);
          }
        });
      };

      findChildrenForRight(child.group.id, 2, child.group.id);
    });
  });

  return {
    parents: Array.from(parentsMap.values()),
    children: Array.from(childrenMap.values()),
  };
}

/**
 * Build a mixed active graph across hierarchy and sibling edges.
 * Sibling steps preserve hierarchy depth and remain attached to their anchor node.
 */
export function buildMixedRelationshipGraph(
  relationships: NormalizedGroupRelationship[],
  targetGroupId: string,
  filterRight?: string,
  currentGroupId: string = targetGroupId
): MixedRelationshipResult {
  const adjacency = new Map<string, TraversalStep[]>();

  relationships.forEach(relationship => {
    if (filterRight && (relationship.with_right ?? '') !== filterRight) {
      return;
    }

    if (relationship.relationship_type === 'sibling') {
      if (
        !isAcceptedSiblingRelationship(relationship) ||
        !relationship.group ||
        !relationship.related_group
      ) {
        return;
      }

      pushTraversalStep(adjacency, relationship.group.id, {
        nextGroupId: relationship.related_group.id,
        nextGroup: relationship.related_group,
        relationship,
        stepType: 'sibling',
      });
      pushTraversalStep(adjacency, relationship.related_group.id, {
        nextGroupId: relationship.group.id,
        nextGroup: relationship.group,
        relationship,
        stepType: 'sibling',
      });
      return;
    }

    if (!isActiveGroupRelationshipStatus(relationship.status)) {
      return;
    }

    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) {
      return;
    }

    const parentEntity = getRelationshipGroupEntity(relationship, pair.parentGroupId);
    const childEntity = getRelationshipGroupEntity(relationship, pair.childGroupId);

    if (!parentEntity || !childEntity) {
      return;
    }

    pushTraversalStep(adjacency, pair.childGroupId, {
      nextGroupId: pair.parentGroupId,
      nextGroup: parentEntity,
      relationship,
      stepType: 'parent',
    });
    pushTraversalStep(adjacency, pair.parentGroupId, {
      nextGroupId: pair.childGroupId,
      nextGroup: childEntity,
      relationship,
      stepType: 'child',
    });
  });

  const parentsMap = new Map<string, RelationshipEntry>();
  const childrenMap = new Map<string, RelationshipEntry>();
  const siblingAttachmentsMap = new Map<string, SiblingAttachmentEntry>();
  const placements = new Map<string, TraversalPlacement>();
  const deque: { groupId: string; placement: TraversalPlacement }[] = [];

  const setPlacementEntry = (
    groupId: string,
    group: NetworkGroupEntity,
    placement: TraversalPlacement,
    relationship: NormalizedGroupRelationship
  ) => {
    parentsMap.delete(groupId);
    childrenMap.delete(groupId);
    siblingAttachmentsMap.delete(groupId);

    if (placement.placementType === 'hierarchy') {
      const entry = createHierarchyEntry(group, placement);
      if (!entry) {
        return;
      }
      applyRelationshipToEntry(entry, relationship, currentGroupId);
      if (placement.branch === 'parent') {
        parentsMap.set(groupId, entry);
      } else {
        childrenMap.set(groupId, entry);
      }
      return;
    }

    if (placement.placementType === 'sibling') {
      const entry = createSiblingAttachmentEntry(group, placement);
      if (!entry) {
        return;
      }
      applyRelationshipToEntry(entry, relationship, currentGroupId);
      siblingAttachmentsMap.set(groupId, entry);
    }
  };

  const mergeIntoPlacementEntry = (
    groupId: string,
    placement: TraversalPlacement,
    relationship: NormalizedGroupRelationship
  ) => {
    if (placement.placementType === 'hierarchy') {
      const entry =
        placement.branch === 'parent' ? parentsMap.get(groupId) : childrenMap.get(groupId);
      if (entry) {
        applyRelationshipToEntry(entry, relationship, currentGroupId);
      }
      return;
    }

    if (placement.placementType === 'sibling') {
      const entry = siblingAttachmentsMap.get(groupId);
      if (entry) {
        applyRelationshipToEntry(entry, relationship, currentGroupId);
      }
    }
  };

  const rootPlacement: TraversalPlacement = {
    placementType: 'root',
    branch: 'root',
    level: 0,
  };

  placements.set(targetGroupId, rootPlacement);
  deque.push({ groupId: targetGroupId, placement: rootPlacement });

  while (deque.length > 0) {
    const current = deque.shift();
    if (!current) {
      continue;
    }

    const bestPlacement = placements.get(current.groupId);
    if (!bestPlacement || !isSamePlacement(bestPlacement, current.placement)) {
      continue;
    }

    const steps = adjacency.get(current.groupId) ?? [];

    steps.forEach(step => {
      const nextPlacement: TraversalPlacement =
        step.stepType === 'sibling'
          ? {
              placementType: 'sibling',
              branch:
                current.placement.branch === 'root' ? 'root-sibling' : current.placement.branch,
              level: current.placement.level,
              anchorId: current.groupId,
            }
          : {
              placementType: 'hierarchy',
              branch: step.stepType,
              level: current.placement.level + 1,
              hierarchyConnectionId: current.groupId,
            };

      const existingPlacement = placements.get(step.nextGroupId);

      if (!existingPlacement || isBetterPlacement(nextPlacement, existingPlacement)) {
        placements.set(step.nextGroupId, nextPlacement);
        setPlacementEntry(step.nextGroupId, step.nextGroup, nextPlacement, step.relationship);

        if (step.stepType === 'sibling') {
          deque.unshift({ groupId: step.nextGroupId, placement: nextPlacement });
        } else {
          deque.push({ groupId: step.nextGroupId, placement: nextPlacement });
        }
        return;
      }

      if (isSamePlacement(nextPlacement, existingPlacement)) {
        mergeIntoPlacementEntry(step.nextGroupId, existingPlacement, step.relationship);
      }
    });
  }

  return {
    parents: Array.from(parentsMap.values()),
    children: Array.from(childrenMap.values()),
    siblingAttachments: Array.from(siblingAttachmentsMap.values()),
  };
}
