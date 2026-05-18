import type { NormalizedGroupRelationship, NetworkGroupEntity } from '../types/network.types';

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

export function getGroupRelationshipDisplayStatus(
  status: string | null | undefined
): string | null {
  if (isRequestGroupRelationshipStatus(status)) {
    return 'requested';
  }

  if (isActiveGroupRelationshipStatus(status)) {
    return 'accepted';
  }

  return status;
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

    if (rel.related_group?.id === targetGroupId && rel.group) {
      const parentId = rel.group.id;
      if (!parentsMap.has(parentId)) {
        parentsMap.set(parentId, {
          group: rel.group,
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

    if (rel.group?.id === targetGroupId && rel.related_group) {
      const childId = rel.related_group.id;
      if (!childrenMap.has(childId)) {
        childrenMap.set(childId, {
          group: rel.related_group,
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
          if (
            rel.related_group?.id === id &&
            (rel.with_right ?? '') === right &&
            rel.group?.id &&
            !visited.has(rel.group.id)
          ) {
            const parentId = rel.group.id;
            visited.add(parentId);

            if (!parentsMap.has(parentId)) {
              parentsMap.set(parentId, {
                group: rel.group,
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
          if (
            rel.group?.id === id &&
            (rel.with_right ?? '') === right &&
            rel.related_group?.id &&
            !visited.has(rel.related_group.id)
          ) {
            const childId = rel.related_group.id;
            visited.add(childId);

            if (!childrenMap.has(childId)) {
              childrenMap.set(childId, {
                group: rel.related_group,
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
