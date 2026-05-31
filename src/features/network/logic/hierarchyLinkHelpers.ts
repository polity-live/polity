import {
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  type HierarchyDuplicatePathConflict,
} from '@/features/groups/logic/hierarchy';
import { isActiveGroupRelationshipStatus } from './networkRelationshipHelpers';
import type { GroupRelationship as GroupRelationshipRow } from '@/zero/network/schema';
import type { NormalizedGroupRelationship } from '../types/network.types';
import { getHierarchyRelationshipPair } from './groupRelationshipOrientation';

/** Passive voting right defines the formal hierarchy tree. */
export const HIERARCHY_TREE_RIGHT = 'passiveVotingRight';

/** All rights that can link two groups (parent → child). */
export const GROUP_LINK_RIGHT_TYPES = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
] as const;

export type GroupLinkRightType = (typeof GROUP_LINK_RIGHT_TYPES)[number];

export function isGroupLinkRelationship(
  relationship: Pick<NormalizedGroupRelationship, 'with_right'>
): boolean {
  const right = relationship.with_right;
  return right != null && (GROUP_LINK_RIGHT_TYPES as readonly string[]).includes(right);
}

/** @deprecated Use {@link isGroupLinkRelationship} */
export const isHierarchyLinkRelationship = isGroupLinkRelationship;

function isActivePvrRelationship(
  relationship: Pick<NormalizedGroupRelationship, 'status' | 'with_right'>
): boolean {
  return (
    relationship.with_right === HIERARCHY_TREE_RIGHT &&
    isActiveGroupRelationshipStatus(relationship.status)
  );
}

function toRelationshipRow(rel: NormalizedGroupRelationship): GroupRelationshipRow {
  return {
    id: rel.id,
    group_id: rel.group_id,
    related_group_id: rel.related_group_id,
    relationship_type: rel.relationship_type ?? null,
    with_right: rel.with_right ?? null,
    status: rel.status ?? null,
    initiator_group_id: rel.initiator_group_id ?? null,
    created_at: rel.created_at ?? 0,
  };
}

/**
 * Build the passive-voting-right graph used by {@link detectLinkConflicts}, optionally
 * simulating that `simulateActiveRel` is already active (only for passive voting right).
 */
export function buildPvrRelationshipsForConflictCheck(
  allRelationships: NormalizedGroupRelationship[],
  simulateActiveRel?: NormalizedGroupRelationship
): GroupRelationshipRow[] {
  const activeRows = allRelationships.filter(isActivePvrRelationship).map(toRelationshipRow);

  if (!simulateActiveRel || simulateActiveRel.with_right !== HIERARCHY_TREE_RIGHT) {
    return activeRows;
  }

  const withoutSimulated = activeRows.filter(row => row.id !== simulateActiveRel.id);

  return [
    ...withoutSimulated,
    {
      ...toRelationshipRow(simulateActiveRel),
      status: 'active',
    },
  ];
}

function buildActiveParentChildLinksForConflictCheck(
  allRelationships: NormalizedGroupRelationship[],
  excludeRelationshipId?: string
): GroupRelationshipRow[] {
  return allRelationships
    .filter(
      rel =>
        rel.id !== excludeRelationshipId &&
        isGroupLinkRelationship(rel) &&
        isActiveGroupRelationshipStatus(rel.status)
    )
    .map(toRelationshipRow);
}

export interface DirectMembershipShape {
  group_id: string;
  user_id: string;
  source: string;
  status: string | null;
}

function buildDuplicatePathConflictKey(conflict: HierarchyDuplicatePathConflict): string {
  const paths = conflict.paths
    .map(path => path.join('>'))
    .sort()
    .join('|');

  return `${conflict.baseGroupId}:${conflict.targetGroupId}:${paths}`;
}

export function getHierarchyLinkDuplicatePathConflicts(
  relationship: NormalizedGroupRelationship,
  allRelationships: NormalizedGroupRelationship[]
): HierarchyDuplicatePathConflict[] {
  if (relationship.with_right !== HIERARCHY_TREE_RIGHT) {
    return [];
  }

  const afterRelationships = buildPvrRelationshipsForConflictCheck(allRelationships, relationship);
  const beforeRelationships = buildPvrRelationshipsForConflictCheck(allRelationships);
  const beforeConflictKeys = new Set(
    detectDuplicateHierarchyPaths(beforeRelationships).map(buildDuplicatePathConflictKey)
  );

  return detectDuplicateHierarchyPaths(afterRelationships).filter(
    conflict => !beforeConflictKeys.has(buildDuplicatePathConflictKey(conflict))
  );
}

/**
 * Returns user IDs that would violate hierarchy exclusivity if `relationship` were activated.
 */
export function getHierarchyLinkConflictUserIds(
  relationship: NormalizedGroupRelationship,
  allRelationships: NormalizedGroupRelationship[],
  directMemberships: DirectMembershipShape[]
): string[] {
  if (!isGroupLinkRelationship(relationship)) {
    return [];
  }

  const pair = getHierarchyRelationshipPair(relationship);
  if (!pair) {
    return [];
  }

  const pvrRelationships = buildPvrRelationshipsForConflictCheck(
    allRelationships,
    relationship.with_right === HIERARCHY_TREE_RIGHT ? relationship : undefined
  );

  const activeParentChildLinks = buildActiveParentChildLinksForConflictCheck(
    allRelationships,
    relationship.id
  );

  return detectLinkConflicts(
    pair.parentGroupId,
    pair.childGroupId,
    pvrRelationships,
    directMemberships,
    activeParentChildLinks
  );
}

export function canActivateHierarchyLink(
  relationship: NormalizedGroupRelationship,
  allRelationships: NormalizedGroupRelationship[],
  directMemberships: DirectMembershipShape[]
): boolean {
  return (
    getHierarchyLinkConflictUserIds(relationship, allRelationships, directMemberships).length ===
      0 && getHierarchyLinkDuplicatePathConflicts(relationship, allRelationships).length === 0
  );
}
