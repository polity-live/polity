/**
 * Pure functions for hierarchical group membership.
 *
 * Operates on plain arrays of group-relationships and group-memberships,
 * so every function is easy to unit-test without a database.
 */

import type { GroupRelationship as GroupRelationshipRow } from '@/zero/network/schema';
import type { GroupMembership as GroupMembershipRow } from '@/zero/groups/schema';

// ── Types (minimal shapes expected from Zero query results) ─────────

// ── Traversal helpers ───────────────────────────────────────────────

/**
 * Resolve all hierarchical ancestor group IDs reachable from `baseGroupId`
 * by walking **upward** through `passiveVotingRight` links.
 *
 * Returns the IDs in bottom-up order (nearest parent first).
 */
export function resolveHierarchicalAncestors(
  baseGroupId: string,
  relationships: GroupRelationshipRow[]
): string[] {
  const pvr = relationships.filter(
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
      if (rel.related_group_id === current && !visited.has(rel.group_id)) {
        visited.add(rel.group_id);
        ancestors.push(rel.group_id);
        queue.push(rel.group_id);
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
  memberships: GroupMembershipRow[]
): string[] {
  const pvr = relationships.filter(
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
      if (rel.group_id === current && !visited.has(rel.related_group_id)) {
        visited.add(rel.related_group_id);
        // Check if the child has children of its own
        const hasChildren = pvr.some(r => r.group_id === rel.related_group_id);
        if (hasChildren) {
          queue.push(rel.related_group_id); // intermediate hierarchical group
        } else {
          baseGroupIds.add(rel.related_group_id); // leaf = base group
        }
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
  memberships: GroupMembershipRow[]
): boolean {
  // 1. Find all hierarchical ancestors of the target base group
  const ancestors = resolveHierarchicalAncestors(targetBaseGroupId, relationships);

  if (ancestors.length === 0) {
    // No hierarchy → no constraint to enforce
    return true;
  }

  // 2. For each ancestor, find all child base groups (excluding the target)
  const siblingBaseGroups = new Set<string>();
  for (const ancestorId of ancestors) {
    const children = resolveChildBaseGroups(ancestorId, relationships);
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
  relationships: GroupRelationshipRow[]
): string[] {
  const pvr = relationships.filter(
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
      if (rel.group_id === current && !visited.has(rel.related_group_id)) {
        visited.add(rel.related_group_id);
        const hasChildren = pvr.some(r => r.group_id === rel.related_group_id);
        if (hasChildren) {
          queue.push(rel.related_group_id);
        } else {
          baseGroups.push(rel.related_group_id);
        }
      }
    }
  }

  return baseGroups;
}

function isActiveRelationshipStatus(status: string | null | undefined): boolean {
  return status == null || status === 'active' || status === 'accepted';
}

/** Base groups represented by a node in the passive-voting-right tree (leaf = the node itself). */
function collectBaseGroupIdsUnderGroup(
  groupId: string,
  pvrRelationships: GroupRelationshipRow[]
): string[] {
  const fromTree = resolveChildBaseGroups(groupId, pvrRelationships);
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
  memberships: GroupMembershipRow[],
  activeParentChildLinks: GroupRelationshipRow[] = []
): string[] {
  const newBaseGroupIds = new Set<string>([
    childGroupId,
    ...resolveChildBaseGroups(childGroupId, pvrRelationships),
  ]);

  const existingBaseGroupIds = new Set<string>();
  for (const baseId of resolveChildBaseGroups(parentGroupId, pvrRelationships)) {
    if (!newBaseGroupIds.has(baseId)) {
      existingBaseGroupIds.add(baseId);
    }
  }

  for (const link of activeParentChildLinks) {
    if (
      link.group_id !== parentGroupId ||
      link.related_group_id === childGroupId ||
      !isActiveRelationshipStatus(link.status)
    ) {
      continue;
    }

    for (const baseId of collectBaseGroupIdsUnderGroup(link.related_group_id, pvrRelationships)) {
      if (!newBaseGroupIds.has(baseId)) {
        existingBaseGroupIds.add(baseId);
      }
    }
  }

  const existingUserIds = new Set<string>();
  for (const m of memberships) {
    if (existingBaseGroupIds.has(m.group_id) && m.source === 'direct') {
      existingUserIds.add(m.user_id);
    }
  }

  const newUserIds = new Set<string>();
  for (const m of memberships) {
    if (newBaseGroupIds.has(m.group_id) && m.source === 'direct') {
      newUserIds.add(m.user_id);
    }
  }

  return [...newUserIds].filter(uid => existingUserIds.has(uid));
}
