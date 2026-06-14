import {
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  type HierarchyRelationshipRow,
  type HierarchyDuplicatePathConflict,
} from '@/features/groups/logic/hierarchy';
import { isActiveGroupRelationshipStatus } from './networkRelationshipHelpers';
import type { NormalizedGroupRelationship } from '../types/network.types';
import { getHierarchyRelationshipPair } from './groupRelationshipOrientation';

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
  relationship: Pick<
    NormalizedGroupRelationship,
    | 'status'
    | 'relationship_type'
    | 'group_id'
    | 'related_group_id'
    | 'connection_type'
    | 'parent_group_id'
    | 'child_group_id'
  >
): boolean {
  return (
    getHierarchyRelationshipPair(relationship) != null &&
    isActiveGroupRelationshipStatus(relationship.status)
  );
}

function toRelationshipRow(rel: NormalizedGroupRelationship): HierarchyRelationshipRow {
  return {
    id: rel.id,
    group_id: rel.group_id,
    related_group_id: rel.related_group_id,
    relationship_type:
      rel.relationship_type ??
      (rel.connection_type === 'peer'
        ? 'sibling'
        : rel.parent_group_id === rel.group_id
          ? 'parent'
          : 'child'),
    with_right: rel.with_right ?? null,
    status: rel.status ?? null,
    initiator_group_id: rel.initiator_group_id ?? null,
    created_at: rel.created_at ?? 0,
    connection_type: rel.connection_type,
    parent_group_id: rel.parent_group_id,
    child_group_id: rel.child_group_id,
  };
}

/**
 * Build the structural hierarchy graph used by {@link detectLinkConflicts}, optionally
 * simulating that `simulateActiveRel` is already active.
 */
export function buildPvrRelationshipsForConflictCheck(
  allRelationships: NormalizedGroupRelationship[],
  simulateActiveRel?: NormalizedGroupRelationship
): HierarchyRelationshipRow[] {
  const activeRows = dedupeHierarchyRows(
    allRelationships.filter(isActivePvrRelationship).map(toRelationshipRow)
  );

  if (!simulateActiveRel || getHierarchyRelationshipPair(simulateActiveRel) == null) {
    return activeRows;
  }

  const simulatedPair = getHierarchyRelationshipPair(simulateActiveRel);
  const withoutSimulated = activeRows.filter(row => {
    const pair = getHierarchyRelationshipPair(row);
    return (
      pair?.parentGroupId !== simulatedPair?.parentGroupId ||
      pair?.childGroupId !== simulatedPair?.childGroupId
    );
  });

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
): HierarchyRelationshipRow[] {
  return dedupeHierarchyRows(
    allRelationships
      .filter(
        rel =>
          rel.id !== excludeRelationshipId &&
          getHierarchyRelationshipPair(rel) != null &&
          isActiveGroupRelationshipStatus(rel.status)
      )
      .map(toRelationshipRow)
  );
}

function dedupeHierarchyRows(rows: HierarchyRelationshipRow[]) {
  const deduped = new Map<string, HierarchyRelationshipRow>();

  for (const row of rows) {
    const pair = getHierarchyRelationshipPair(row);
    if (!pair) {
      continue;
    }

    const key = `${pair.parentGroupId}:${pair.childGroupId}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  }

  return [...deduped.values()];
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
  if (getHierarchyRelationshipPair(relationship) == null) {
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
  if (getHierarchyRelationshipPair(relationship) == null) {
    return [];
  }

  const pair = getHierarchyRelationshipPair(relationship);
  if (!pair) {
    return [];
  }

  const pvrRelationships = buildPvrRelationshipsForConflictCheck(allRelationships, relationship);

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
