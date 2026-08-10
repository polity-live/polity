/**
 * Pure functions for hierarchical group membership.
 *
 * Operates on plain arrays of group-relationships and group-memberships,
 * so every function is easy to unit-test without a database.
 */

import type { GroupMembership as GroupMembershipRow } from '@/zero/groups/schema';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';

// ── Types (minimal shapes expected from Zero query results) ─────────
export interface HierarchyRelationshipRow {
  id: string;
  group_id: string;
  related_group_id: string;
  relationship_type: 'parent' | 'child' | 'sibling' | null;
  with_right?: string | null;
  status: string | null;
  initiator_group_id?: string | null;
  created_at?: number;
  connection_type?: 'hierarchy' | 'peer' | null;
  parent_group_id?: string | null;
  child_group_id?: string | null;
}

type GroupRelationshipRow = HierarchyRelationshipRow;
type GroupTypeLookup = ReadonlyMap<string, { group_type?: string | null | undefined }>;
type MembershipConflictRow = Pick<GroupMembershipRow, 'group_id' | 'user_id' | 'source' | 'status'>;

function filterHierarchySafeRelationships(
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
) {
  return relationships.filter(relationship => {
    if (!groupsById) {
      return true;
    }

    const sourceType = groupsById.get(relationship.group_id)?.group_type ?? null;
    const relatedType = groupsById.get(relationship.related_group_id)?.group_type ?? null;
    return sourceType !== 'sibling' && relatedType !== 'sibling';
  });
}

function getActiveHierarchyRelationships(
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
) {
  const dedupedByPair = new Map<string, GroupRelationshipRow>();

  for (const relationship of filterHierarchySafeRelationships(relationships, groupsById)) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair || !isActiveRelationshipStatus(relationship.status)) {
      continue;
    }

    const key = `${pair.parentGroupId}:${pair.childGroupId}`;
    if (!dedupedByPair.has(key)) {
      dedupedByPair.set(key, relationship);
    }
  }

  return [...dedupedByPair.values()];
}

// ── Traversal helpers ───────────────────────────────────────────────

/**
 * Resolve all hierarchical ancestor group IDs reachable from `baseGroupId`
 * by walking **upward** through active structural parent/child links.
 *
 * Returns the IDs in bottom-up order (nearest parent first).
 */
export function resolveHierarchicalAncestors(
  baseGroupId: string,
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const hierarchyRelationships = getActiveHierarchyRelationships(relationships, groupsById);

  const ancestors: string[] = [];
  const visited = new Set<string>();
  const queue = [baseGroupId];

  while (queue.length > 0) {
    const current = queue.shift();
    // Find parents of `current` (current is the child → related_group_id)
    for (const rel of hierarchyRelationships) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair) continue;

      if (pair.childGroupId === current && !visited.has(pair.parentGroupId)) {
        visited.add(pair.parentGroupId);
        ancestors.push(pair.parentGroupId);
        queue.push(pair.parentGroupId);
      }
    }
  }

  return ancestors;
}

/**
 * Resolve all **base-group member user IDs** reachable from a hierarchical
 * group by walking **downward** through active structural parent/child links.
 *
 * Only returns users with `source === 'direct'` in the leaf base groups.
 */
export function resolveBaseGroupMembers(
  hierarchicalGroupId: string,
  relationships: GroupRelationshipRow[],
  memberships: GroupMembershipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const hierarchyRelationships = getActiveHierarchyRelationships(relationships, groupsById);

  // Collect all descendant base groups
  const baseGroupIds = new Set<string>();
  const visited = new Set<string>();
  const queue = [hierarchicalGroupId];

  while (queue.length > 0) {
    const current = queue.shift();
    // Find children of `current` (current is the parent → group_id)
    for (const rel of hierarchyRelationships) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair) continue;
      if (pair.parentGroupId !== current || visited.has(pair.childGroupId)) {
        continue;
      }

      visited.add(pair.childGroupId);
      const hasChildren = hierarchyRelationships.some(candidate => {
        const candidatePair = getHierarchyRelationshipPair(candidate);
        return candidatePair?.parentGroupId === pair.childGroupId;
      });
      if (hasChildren) {
        queue.push(pair.childGroupId); // intermediate hierarchical group
      } else {
        baseGroupIds.add(pair.childGroupId); // leaf = base group
      }
    }
  }

  // Collect unique user IDs from those base groups (direct memberships only)
  const userIds = new Set<string>();
  for (const m of memberships) {
    if (baseGroupIds.has(m.group_id) && m.source === 'direct') {
      userIds.add(m.user_id);
    }
  }

  return [...userIds];
}

/**
 * Check the exclusivity constraint: a user must NOT be a direct member of
 * another base group that shares a hierarchical ancestor with `targetBaseGroupId`.
 *
 * Returns `true` when the user **can** safely join (no conflict).
 */
export function checkExclusivityConstraint(
  userId: string,
  targetBaseGroupId: string,
  relationships: GroupRelationshipRow[],
  memberships: GroupMembershipRow[],
  groupsById?: GroupTypeLookup
): boolean {
  // 1. Find all hierarchical ancestors of the target base group
  const ancestors = resolveHierarchicalAncestors(targetBaseGroupId, relationships, groupsById);

  if (ancestors.length === 0) {
    // No hierarchy → no constraint to enforce
    return true;
  }

  // 2. For each ancestor, find all child base groups (excluding the target)
  const siblingBaseGroups = new Set<string>();
  for (const ancestorId of ancestors) {
    const children = resolveChildBaseGroups(ancestorId, relationships, groupsById);
    for (const childId of children) {
      if (childId !== targetBaseGroupId) {
        siblingBaseGroups.add(childId);
      }
    }
  }

  // 3. Check if the user is a direct member of a sibling base group
  for (const m of memberships) {
    if (m.user_id === userId && m.source === 'direct' && siblingBaseGroups.has(m.group_id)) {
      return false; // Conflict: user already in a sibling base group
    }
  }

  return true;
}

/**
 * Find all base (leaf) groups below a given group in the active structural hierarchy tree.
 */
export function resolveChildBaseGroups(
  groupId: string,
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const hierarchyRelationships = getActiveHierarchyRelationships(relationships, groupsById);

  const baseGroups: string[] = [];
  const visited = new Set<string>();
  const queue = [groupId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const rel of hierarchyRelationships) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair) continue;
      if (pair.parentGroupId !== current || visited.has(pair.childGroupId)) {
        continue;
      }

      visited.add(pair.childGroupId);
      const hasChildren = hierarchyRelationships.some(candidate => {
        const candidatePair = getHierarchyRelationshipPair(candidate);
        return candidatePair?.parentGroupId === pair.childGroupId;
      });
      if (hasChildren) {
        queue.push(pair.childGroupId);
      } else {
        baseGroups.push(pair.childGroupId);
      }
    }
  }

  return baseGroups;
}

function isActiveRelationshipStatus(status: string | null | undefined): boolean {
  return status === 'active';
}

function isActiveDirectMembership(
  membership: Pick<GroupMembershipRow, 'status' | 'source'>
): boolean {
  return (
    membership.source === 'direct' &&
    (membership.status === 'active' ||
      membership.status === 'member' ||
      membership.status === 'admin')
  );
}

/** Base groups represented by a node in the structural hierarchy tree (leaf = the node itself). */
function collectBaseGroupIdsUnderGroup(
  groupId: string,
  hierarchyRelationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const fromTree = resolveChildBaseGroups(groupId, hierarchyRelationships, groupsById);
  return fromTree.length > 0 ? fromTree : [groupId];
}

/**
 * Detect member-overlap conflicts that would arise from linking `childGroupId`
 * under `parentGroupId` in the hierarchy.
 *
 * `pvrRelationships` defines the active structural hierarchy tree. `activeParentChildLinks`
 * adds sibling subtrees from already-active links of any right type.
 *
 * Returns user IDs that appear in both the new child and an existing sibling base group.
 */
export function detectLinkConflicts(
  parentGroupId: string,
  childGroupId: string,
  pvrRelationships: GroupRelationshipRow[],
  memberships: MembershipConflictRow[],
  activeParentChildLinks: GroupRelationshipRow[] = [],
  groupsById?: GroupTypeLookup
): string[] {
  const hierarchySafePvrRelationships = getActiveHierarchyRelationships(
    pvrRelationships,
    groupsById
  );
  const hierarchySafeParentChildLinks = getActiveHierarchyRelationships(
    activeParentChildLinks,
    groupsById
  );
  const newBaseGroupIds = new Set<string>([
    childGroupId,
    ...resolveChildBaseGroups(childGroupId, hierarchySafePvrRelationships, groupsById),
  ]);

  const existingBaseGroupIds = new Set<string>();
  for (const baseId of resolveChildBaseGroups(
    parentGroupId,
    hierarchySafePvrRelationships,
    groupsById
  )) {
    if (!newBaseGroupIds.has(baseId)) {
      existingBaseGroupIds.add(baseId);
    }
  }

  for (const link of hierarchySafeParentChildLinks) {
    const pair = getHierarchyRelationshipPair(link);
    if (!pair) continue;

    if (pair.parentGroupId !== parentGroupId || pair.childGroupId === childGroupId) {
      continue;
    }

    for (const baseId of collectBaseGroupIdsUnderGroup(
      pair.childGroupId,
      hierarchySafePvrRelationships,
      groupsById
    )) {
      if (!newBaseGroupIds.has(baseId)) {
        existingBaseGroupIds.add(baseId);
      }
    }
  }

  const existingUserIds = new Set<string>();
  for (const m of memberships) {
    if (existingBaseGroupIds.has(m.group_id) && isActiveDirectMembership(m)) {
      existingUserIds.add(m.user_id);
    }
  }

  const newUserIds = new Set<string>();
  for (const m of memberships) {
    if (newBaseGroupIds.has(m.group_id) && isActiveDirectMembership(m)) {
      newUserIds.add(m.user_id);
    }
  }

  return [...newUserIds].filter(uid => existingUserIds.has(uid));
}

export interface HierarchyDuplicatePathConflict {
  baseGroupId: string;
  targetGroupId: string;
  paths: string[][];
}

export function collectPathMapForBaseGroup(
  baseGroupId: string,
  relationships: GroupRelationshipRow[]
): Map<string, string[][]> {
  const activeHierarchyRelationships = getActiveHierarchyRelationships(relationships);
  const parentIdsByChildId = new Map<string, string[]>();

  for (const relationship of activeHierarchyRelationships) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) continue;

    const existingParentIds = parentIdsByChildId.get(pair.childGroupId) ?? [];
    existingParentIds.push(pair.parentGroupId);
    parentIdsByChildId.set(pair.childGroupId, existingParentIds);
  }

  const pathsByTargetGroupId = new Map<string, string[][]>();

  const walk = (currentGroupId: string, path: string[]) => {
    const parentIds = parentIdsByChildId.get(currentGroupId) ?? [];

    for (const parentGroupId of parentIds) {
      if (path.includes(parentGroupId)) {
        continue;
      }

      const nextPath = [...path, parentGroupId];
      const existingPaths = pathsByTargetGroupId.get(parentGroupId) ?? [];

      if (existingPaths.length < 2) {
        existingPaths.push(nextPath);
        pathsByTargetGroupId.set(parentGroupId, existingPaths);
      }

      walk(parentGroupId, nextPath);
    }
  };

  walk(baseGroupId, [baseGroupId]);
  return pathsByTargetGroupId;
}

export function detectDuplicateHierarchyPaths(
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): HierarchyDuplicatePathConflict[] {
  const hierarchySafeRelationships = getActiveHierarchyRelationships(relationships, groupsById);

  const childIds = new Set<string>();
  const parentIds = new Set<string>();

  for (const relationship of hierarchySafeRelationships) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) continue;

    childIds.add(pair.childGroupId);
    parentIds.add(pair.parentGroupId);
  }

  const leafBaseGroupIds =
    groupsById == null
      ? [...childIds].filter(groupId => !parentIds.has(groupId))
      : [...childIds].filter(groupId => {
          const groupType = groupsById.get(groupId)?.group_type ?? null;
          return groupType === 'base' && !parentIds.has(groupId);
        });

  const conflicts: HierarchyDuplicatePathConflict[] = [];

  for (const baseGroupId of leafBaseGroupIds) {
    const pathsByTargetGroupId = collectPathMapForBaseGroup(
      baseGroupId,
      hierarchySafeRelationships
    );

    for (const [targetGroupId, paths] of pathsByTargetGroupId.entries()) {
      if (paths.length < 2) {
        continue;
      }

      conflicts.push({
        baseGroupId,
        targetGroupId,
        paths: paths.slice(0, 2),
      });
    }
  }

  return conflicts;
}
