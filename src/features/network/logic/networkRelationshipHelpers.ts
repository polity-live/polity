import type {
  CanonicalMembershipMode,
  GroupRelationshipType,
  NormalizedGroupRelationship,
  RelativeMembershipDirection,
  NetworkGroupEntity,
} from '../types/network.types';
import {
  getHierarchyRelationshipPair,
  getRelationshipTypeForGroup,
  matchesRelationshipSelection,
} from './groupRelationshipOrientation';

export type NetworkRelationshipKind = 'active' | 'incoming' | 'outgoing';
export type RelationshipTraversalMode = 'structure' | 'right';

function shouldReplaceMembershipMode(
  existingMode: CanonicalMembershipMode | null | undefined,
  nextMode: CanonicalMembershipMode | null | undefined
) {
  if (!nextMode) {
    return false;
  }

  if (!existingMode) {
    return true;
  }

  return existingMode === 'none' && nextMode !== 'none';
}

export function isActiveGroupRelationshipStatus(status: string | null | undefined): boolean {
  return status === 'active';
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

export function getRelativeMembershipDirectionForRelationship(args: {
  relationship: Pick<
    NormalizedGroupRelationship,
    'member_source_group_id' | 'member_target_group_id'
  >;
  currentGroupId: string;
}): RelativeMembershipDirection | null {
  const sourceGroupId = args.relationship.member_source_group_id;
  const targetGroupId = args.relationship.member_target_group_id;
  if (!sourceGroupId || !targetGroupId) {
    return null;
  }

  if (args.currentGroupId !== sourceGroupId && args.currentGroupId !== targetGroupId) {
    return null;
  }

  return args.currentGroupId === sourceGroupId
    ? 'current_members_to_partner'
    : 'partner_members_to_current';
}

function applyRelationshipToEntry(
  entry: RelationshipEntry,
  relationship: NormalizedGroupRelationship,
  currentGroupId: string
): void {
  const rightValue = relationship.with_right;

  if (rightValue && !entry.rights.includes(rightValue)) {
    entry.rights.push(rightValue);
  }

  const relationshipKind = getGroupRelationshipKind(relationship, currentGroupId);

  if (relationshipKind && !entry.relationshipKinds.includes(relationshipKind)) {
    entry.relationshipKinds.push(relationshipKind);
  }

  const mergedRightKind = mergeRightRelationshipKind(
    rightValue ? entry.rightRelationshipKinds[rightValue] : undefined,
    relationshipKind
  );

  if (rightValue && mergedRightKind) {
    entry.rightRelationshipKinds[rightValue] = mergedRightKind;
  }

  if (!entry.sourceRelationshipType && relationship.relationship_type) {
    entry.sourceRelationshipType = relationship.relationship_type;
  }

  if (shouldReplaceMembershipMode(entry.membershipMode, relationship.membership_mode)) {
    entry.membershipMode = relationship.membership_mode;
    entry.memberSourceGroupId = relationship.member_source_group_id ?? null;
    entry.memberTargetGroupId = relationship.member_target_group_id ?? null;
    entry.membershipDirection = getRelativeMembershipDirectionForRelationship({
      relationship,
      currentGroupId,
    });
  }
}

export interface RelationshipEntry {
  group: NetworkGroupEntity;
  rights: string[];
  relationshipKinds: NetworkRelationshipKind[];
  rightRelationshipKinds: Record<string, NetworkRelationshipKind>;
  sourceRelationshipType?: GroupRelationshipType | null;
  membershipMode?: CanonicalMembershipMode | null;
  memberSourceGroupId?: string | null;
  memberTargetGroupId?: string | null;
  membershipDirection?: RelativeMembershipDirection | null;
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
    sourceRelationshipType: null,
    membershipMode: null,
    memberSourceGroupId: null,
    memberTargetGroupId: null,
    membershipDirection: null,
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
    sourceRelationshipType: null,
    membershipMode: null,
    memberSourceGroupId: null,
    memberTargetGroupId: null,
    membershipDirection: null,
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

function createEmptyRelationshipEntry(
  group: NetworkGroupEntity,
  extra?: Partial<
    Pick<RelationshipEntry, 'level' | 'childId' | 'parentId' | 'sourceRelationshipType'>
  >
): RelationshipEntry {
  return {
    group,
    rights: [],
    relationshipKinds: [],
    rightRelationshipKinds: {},
    sourceRelationshipType: extra?.sourceRelationshipType ?? null,
    membershipMode: null,
    memberSourceGroupId: null,
    memberTargetGroupId: null,
    membershipDirection: null,
    level: extra?.level,
    childId: extra?.childId,
    parentId: extra?.parentId,
  };
}

function getRightScopePlacement(relationship: NormalizedGroupRelationship): {
  branch: 'parent' | 'child';
  sourceRelationshipType: GroupRelationshipType | null;
} {
  const holderRelationshipType =
    getRelationshipTypeForGroup(relationship, relationship.group_id) ??
    relationship.relationship_type ??
    null;
  const scopeRelationshipType = getRelationshipTypeForGroup(
    relationship,
    relationship.related_group_id
  );

  return {
    branch: scopeRelationshipType === 'parent' ? 'parent' : 'child',
    sourceRelationshipType: holderRelationshipType,
  };
}

function upsertRightScopeEntry({
  parentsMap,
  childrenMap,
  relationship,
  scopeEntity,
  holderGroupId,
  currentGroupId,
  level,
}: {
  parentsMap: Map<string, RelationshipEntry>;
  childrenMap: Map<string, RelationshipEntry>;
  relationship: NormalizedGroupRelationship;
  scopeEntity: NetworkGroupEntity;
  holderGroupId: string;
  currentGroupId: string;
  level?: number;
}) {
  const placement = getRightScopePlacement(relationship);
  const targetMap = placement.branch === 'parent' ? parentsMap : childrenMap;
  const existingEntry = targetMap.get(scopeEntity.id);

  if (!existingEntry) {
    targetMap.set(
      scopeEntity.id,
      createEmptyRelationshipEntry(scopeEntity, {
        level,
        childId: placement.branch === 'parent' ? holderGroupId : undefined,
        parentId: placement.branch === 'child' ? holderGroupId : undefined,
        sourceRelationshipType: placement.sourceRelationshipType,
      })
    );
  }

  const entry = targetMap.get(scopeEntity.id);
  if (!entry) {
    return null;
  }

  applyRelationshipToEntry(entry, relationship, currentGroupId);

  if (level !== undefined) {
    entry.level = entry.level ?? level;
  }

  if (placement.branch === 'parent') {
    entry.childId = entry.childId ?? holderGroupId;
  } else {
    entry.parentId = entry.parentId ?? holderGroupId;
  }

  return entry;
}

/**
 * Build direct (one-level) parent/child relationships for a target group.
 */
export function buildDirectRelationships(
  relationships: NormalizedGroupRelationship[],
  targetGroupId: string,
  filterRight?: string,
  currentGroupId: string = targetGroupId,
  traversalMode: RelationshipTraversalMode = 'structure'
): RelationshipResult {
  const parentsMap = new Map<string, RelationshipEntry>();
  const childrenMap = new Map<string, RelationshipEntry>();

  relationships.forEach(rel => {
    if (filterRight && (rel.with_right ?? '') !== filterRight) {
      return;
    }

    if (traversalMode === 'right') {
      if (!rel.with_right || !rel.grant_id || rel.group_id !== targetGroupId) {
        return;
      }

      const scopeEntity = getRelationshipGroupEntity(rel, rel.related_group_id);
      if (!scopeEntity) {
        return;
      }

      upsertRightScopeEntry({
        parentsMap,
        childrenMap,
        relationship: rel,
        scopeEntity,
        holderGroupId: targetGroupId,
        currentGroupId,
      });
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
          membershipMode: null,
          memberSourceGroupId: null,
          memberTargetGroupId: null,
          membershipDirection: null,
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
          membershipMode: null,
          memberSourceGroupId: null,
          memberTargetGroupId: null,
          membershipDirection: null,
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
  currentGroupId: string = targetGroupId,
  traversalMode: RelationshipTraversalMode = 'structure'
): RelationshipResult {
  const parentsMap = new Map<string, RelationshipEntry>();
  const childrenMap = new Map<string, RelationshipEntry>();

  const directRels = buildDirectRelationships(
    relationships,
    targetGroupId,
    filterRight,
    currentGroupId,
    traversalMode
  );

  if (traversalMode === 'right') {
    const cloneRightEntry = (entry: RelationshipEntry, branch: 'parent' | 'child') => ({
      group: entry.group,
      rights: [...entry.rights],
      relationshipKinds: [...entry.relationshipKinds],
      rightRelationshipKinds: { ...entry.rightRelationshipKinds },
      sourceRelationshipType: entry.sourceRelationshipType ?? null,
      membershipMode: entry.membershipMode ?? null,
      memberSourceGroupId: entry.memberSourceGroupId ?? null,
      memberTargetGroupId: entry.memberTargetGroupId ?? null,
      membershipDirection: entry.membershipDirection ?? null,
      level: 1,
      childId: branch === 'parent' ? targetGroupId : undefined,
      parentId: branch === 'child' ? targetGroupId : undefined,
    });

    directRels.parents.forEach(parent => {
      parentsMap.set(parent.group.id, cloneRightEntry(parent, 'parent'));
    });

    directRels.children.forEach(child => {
      childrenMap.set(child.group.id, cloneRightEntry(child, 'child'));
    });

    const directEntries = [
      ...directRels.parents.map(entry => ({ entry, branch: 'parent' as const })),
      ...directRels.children.map(entry => ({ entry, branch: 'child' as const })),
    ];

    directEntries.forEach(({ entry }) => {
      entry.rights.forEach(right => {
        const visited = new Set<string>([targetGroupId, entry.group.id]);

        const findScopesForRight = (holderId: string, level: number) => {
          relationships.forEach(rel => {
            if ((rel.with_right ?? '') !== right) return;
            if (!rel.grant_id || rel.group_id !== holderId || visited.has(rel.related_group_id)) {
              return;
            }

            const scopeEntity = getRelationshipGroupEntity(rel, rel.related_group_id);
            if (!scopeEntity) {
              return;
            }

            visited.add(scopeEntity.id);

            upsertRightScopeEntry({
              parentsMap,
              childrenMap,
              relationship: rel,
              scopeEntity,
              holderGroupId: holderId,
              currentGroupId,
              level,
            });

            findScopesForRight(scopeEntity.id, level + 1);
          });
        };

        findScopesForRight(entry.group.id, 2);
      });
    });

    return {
      parents: Array.from(parentsMap.values()),
      children: Array.from(childrenMap.values()),
    };
  }

  // For parents: Add direct parents first (level 1), then follow chains for each right type
  directRels.parents.forEach(parent => {
    parentsMap.set(parent.group.id, {
      group: parent.group,
      rights: [...parent.rights],
      relationshipKinds: [...parent.relationshipKinds],
      rightRelationshipKinds: { ...parent.rightRelationshipKinds },
      sourceRelationshipType: parent.sourceRelationshipType ?? null,
      membershipMode: parent.membershipMode ?? null,
      memberSourceGroupId: parent.memberSourceGroupId ?? null,
      memberTargetGroupId: parent.memberTargetGroupId ?? null,
      membershipDirection: parent.membershipDirection ?? null,
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
                membershipMode: null,
                memberSourceGroupId: null,
                memberTargetGroupId: null,
                membershipDirection: null,
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
      sourceRelationshipType: child.sourceRelationshipType ?? null,
      membershipMode: child.membershipMode ?? null,
      memberSourceGroupId: child.memberSourceGroupId ?? null,
      memberTargetGroupId: child.memberTargetGroupId ?? null,
      membershipDirection: child.membershipDirection ?? null,
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
                membershipMode: null,
                memberSourceGroupId: null,
                memberTargetGroupId: null,
                membershipDirection: null,
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
  currentGroupId: string = targetGroupId,
  traversalMode: RelationshipTraversalMode = 'structure'
): MixedRelationshipResult {
  const adjacency = new Map<string, TraversalStep[]>();

  relationships.forEach(relationship => {
    if (filterRight && (relationship.with_right ?? '') !== filterRight) {
      return;
    }

    if (traversalMode === 'right') {
      if (
        !relationship.with_right ||
        !relationship.grant_id ||
        !isActiveGroupRelationshipStatus(relationship.status) ||
        !relationship.group ||
        !relationship.related_group
      ) {
        return;
      }

      const scopeRelationshipType = getRelationshipTypeForGroup(
        relationship,
        relationship.related_group.id
      );

      pushTraversalStep(adjacency, relationship.group.id, {
        nextGroupId: relationship.related_group.id,
        nextGroup: relationship.related_group,
        relationship,
        stepType:
          scopeRelationshipType === 'parent'
            ? 'parent'
            : scopeRelationshipType === 'sibling'
              ? 'sibling'
              : 'child',
      });
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
