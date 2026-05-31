/**
 * Pure functions for hierarchical group membership.
 *
 * Operates on plain arrays of group-relationships and group-memberships,
 * so every function is easy to unit-test without a database.
 */

import type { GroupRelationship as GroupRelationshipRow } from '@/zero/network/schema';
import type { GroupMembership as GroupMembershipRow } from '@/zero/groups/schema';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';

// ── Types (minimal shapes expected from Zero query results) ─────────
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

// ── Traversal helpers ───────────────────────────────────────────────

/**
 * Resolve all hierarchical ancestor group IDs reachable from `baseGroupId`
 * by walking **upward** through `passiveVotingRight` links.
 *
 * Returns the IDs in bottom-up order (nearest parent first).
 */
export function resolveHierarchicalAncestors(
  baseGroupId: string,
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const pvr = filterHierarchySafeRelationships(relationships, groupsById).filter(
    r => r.with_right === 'passiveVotingRight' && r.status === 'active'
  );

  const ancestors: string[] = [];
  const visited = new Set<string>();
  const queue = [baseGroupId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) {
      continue;
    }
    // Find parents of `current` (current is the child → related_group_id)
    for (const rel of pvr) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair) {
        continue;
      }

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
 * group by walking **downward** through `passiveVotingRight` links.
 *
 * Only returns users with `source === 'direct'` in the leaf base groups.
 */
export function resolveBaseGroupMembers(
  hierarchicalGroupId: string,
  relationships: GroupRelationshipRow[],
  memberships: GroupMembershipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const pvr = filterHierarchySafeRelationships(relationships, groupsById).filter(
    r => r.with_right === 'passiveVotingRight' && r.status === 'active'
  );

  // Collect all descendant base groups
  const baseGroupIds = new Set<string>();
  const visited = new Set<string>();
  const queue = [hierarchicalGroupId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) {
      continue;
    }
    // Find children of `current` (current is the parent → group_id)
    for (const rel of pvr) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair || pair.parentGroupId !== current || visited.has(pair.childGroupId)) {
        continue;
      }

      visited.add(pair.childGroupId);
      const hasChildren = pvr.some(candidate => {
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
 * Find all base (leaf) groups below a given group in the passive-voting-right tree.
 */
export function resolveChildBaseGroups(
  groupId: string,
  relationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const pvr = filterHierarchySafeRelationships(relationships, groupsById).filter(
    r => r.with_right === 'passiveVotingRight' && r.status === 'active'
  );

  const baseGroups: string[] = [];
  const visited = new Set<string>();
  const queue = [groupId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) {
      continue;
    }
    for (const rel of pvr) {
      const pair = getHierarchyRelationshipPair(rel);
      if (!pair || pair.parentGroupId !== current || visited.has(pair.childGroupId)) {
        continue;
      }

      visited.add(pair.childGroupId);
      const hasChildren = pvr.some(candidate => {
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
  return status == null || status === 'active' || status === 'accepted';
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

/** Base groups represented by a node in the passive-voting-right tree (leaf = the node itself). */
function collectBaseGroupIdsUnderGroup(
  groupId: string,
  pvrRelationships: GroupRelationshipRow[],
  groupsById?: GroupTypeLookup
): string[] {
  const fromTree = resolveChildBaseGroups(groupId, pvrRelationships, groupsById);
  return fromTree.length > 0 ? fromTree : [groupId];
}

/**
 * Detect member-overlap conflicts that would arise from linking `childGroupId`
 * under `parentGroupId` in the hierarchy.
 *
 * `pvrRelationships` defines the passive-voting-right tree. `activeParentChildLinks`
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
  const hierarchySafePvrRelationships = filterHierarchySafeRelationships(
    pvrRelationships,
    groupsById
  );
  const hierarchySafeParentChildLinks = filterHierarchySafeRelationships(
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
    if (!pair) {
      continue;
    }

    if (
      pair.parentGroupId !== parentGroupId ||
      pair.childGroupId === childGroupId ||
      !isActiveRelationshipStatus(link.status)
    ) {
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

function collectPathMapForBaseGroup(
  baseGroupId: string,
  relationships: GroupRelationshipRow[]
): Map<string, string[][]> {
  const activePvrRelationships = relationships.filter(
    relationship =>
      relationship.with_right === 'passiveVotingRight' && relationship.status === 'active'
  );
  const parentIdsByChildId = new Map<string, string[]>();

  for (const relationship of activePvrRelationships) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) {
      continue;
    }

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
  const hierarchySafeRelationships = filterHierarchySafeRelationships(
    relationships,
    groupsById
  ).filter(
    relationship =>
      relationship.with_right === 'passiveVotingRight' && relationship.status === 'active'
  );

  const childIds = new Set<string>();
  const parentIds = new Set<string>();

  for (const relationship of hierarchySafeRelationships) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) {
      continue;
    }

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
