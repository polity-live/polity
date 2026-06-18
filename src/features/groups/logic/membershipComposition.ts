import { getMembershipDisplayRoles } from '@/features/groups/logic/membershipDisplayRoles';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';
import type {
  ParticipationGroupLike,
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import type {
  MembershipCompositionBucket,
  MembershipProvenanceGroup,
} from '@/features/groups/types/group.types';

export const DIRECT_WITHOUT_PATH_LABEL = '__direct_without_path__';

interface MembershipProvenanceDisplayOptions {
  directWithoutPathLabel?: string;
  emptyLabel?: string;
}

export interface MembershipCompositionGroupLike extends ParticipationGroupLike {
  id: string;
  connected_group_id?: string | null;
  sibling_membership_mode?: string | null;
}

interface ResolvedMembershipCompositionGroup extends MembershipProvenanceGroup {
  connected_group_id?: string | null;
  sibling_membership_mode?: string | null;
}

export interface MembershipCompositionRelationshipLike {
  group_id: string;
  related_group_id: string;
  relationship_type?: string | null;
  connection_type?: string | null;
  parent_group_id?: string | null;
  child_group_id?: string | null;
  with_right?: string | null;
  status?: string | null;
  group?: ParticipationGroupLike | null;
  related_group?: ParticipationGroupLike | null;
}

export interface MembershipWithCompositionSource<
  TRole extends ParticipationRoleLike = ParticipationRoleLike,
> extends ParticipationLike<TRole> {
  id: string;
  user_id?: string | null;
  group_id?: string | null;
  source_group_id?: string | null;
  part_group_id?: string | null;
  base_group_id?: string | null;
  group?: MembershipCompositionGroupLike | null;
  source_group?: MembershipCompositionGroupLike | null;
  part_group?: MembershipCompositionGroupLike | null;
  base_group?: MembershipCompositionGroupLike | null;
  origins?:
    | readonly {
        origin_kind?: string | null;
        source_group_id?: string | null;
        part_group_id?: string | null;
        base_group_id?: string | null;
        part_group?: MembershipCompositionGroupLike | null;
        base_group?: MembershipCompositionGroupLike | null;
        source_group?: MembershipCompositionGroupLike | null;
      }[]
    | null;
}

export interface MembershipProvenanceFields {
  partGroup: MembershipProvenanceGroup | null;
  baseGroup: MembershipProvenanceGroup | null;
  provenanceBucketLabel: string | null;
}

interface ResolveMembershipProvenanceArgs<
  TMembership extends MembershipWithCompositionSource = MembershipWithCompositionSource,
  TRootMembership extends MembershipWithCompositionSource = MembershipWithCompositionSource,
> {
  group: MembershipCompositionGroupLike;
  memberships: readonly TMembership[];
  relationships: readonly MembershipCompositionRelationshipLike[];
  rootMemberships?: readonly TRootMembership[];
}

function isHierarchicalGroup(group: MembershipCompositionGroupLike | null | undefined) {
  return group?.group_type === 'hierarchical';
}

function isSupportedSiblingGroup(group: MembershipCompositionGroupLike | null | undefined) {
  return (
    group?.group_type === 'sibling' &&
    (group.sibling_membership_mode === 'parliament' || group.sibling_membership_mode === 'elected')
  );
}

export function supportsMembershipComposition(
  group: MembershipCompositionGroupLike | null | undefined
) {
  return isHierarchicalGroup(group) || isSupportedSiblingGroup(group);
}

export function getMembershipProvenanceDisplayLabel(
  membership: Pick<ParticipationLike, 'partGroup' | 'baseGroup' | 'provenanceBucketLabel'>,
  column: 'partGroup' | 'baseGroup',
  options?: MembershipProvenanceDisplayOptions
) {
  const directWithoutPathLabel = options?.directWithoutPathLabel ?? DIRECT_WITHOUT_PATH_LABEL;
  const emptyLabel = options?.emptyLabel ?? '—';
  const bucketLabel =
    membership.provenanceBucketLabel === DIRECT_WITHOUT_PATH_LABEL
      ? directWithoutPathLabel
      : membership.provenanceBucketLabel;

  if (column === 'partGroup') {
    return membership.partGroup?.name || bucketLabel || emptyLabel;
  }

  return membership.baseGroup?.name || bucketLabel || emptyLabel;
}

export function resolveMembershipProvenance<
  TMembership extends MembershipWithCompositionSource,
  TRootMembership extends MembershipWithCompositionSource,
>({
  group,
  memberships,
  relationships,
  rootMemberships = [],
}: ResolveMembershipProvenanceArgs<TMembership, TRootMembership>) {
  const groupsById = buildGroupLookup(group, memberships, rootMemberships, relationships);
  const activeRelationships = relationships.filter(isActivePassiveVotingRelationship);
  const activeRootMemberships = rootMemberships.filter(isActiveMembership);
  const activeRootMembershipByKey = new Map<string, TRootMembership>();

  for (const membership of activeRootMemberships) {
    const rootGroupId = membership.group_id;
    const userId = getMembershipUserId(membership);
    if (!rootGroupId || !userId) {
      continue;
    }

    const key = getRootMembershipKey(rootGroupId, userId);
    if (!activeRootMembershipByKey.has(key)) {
      activeRootMembershipByKey.set(key, membership);
    }
  }

  return memberships.map(membership => ({
    ...membership,
    ...resolveSingleMembershipProvenance({
      membership,
      currentGroup: group,
      activeRelationships,
      groupsById,
      activeRootMembershipByKey,
      activeRootMemberships,
    }),
  }));
}

export function buildMembershipCompositionBuckets<
  TMembership extends Pick<
    MembershipWithCompositionSource,
    'partGroup' | 'provenanceBucketLabel' | 'roles' | 'role'
  >,
>(memberships: readonly TMembership[]): MembershipCompositionBucket[] {
  const buckets = new Map<
    string,
    Pick<MembershipCompositionBucket, 'key' | 'label' | 'memberCount' | 'leadershipAssignmentCount'>
  >();

  for (const membership of memberships) {
    const key =
      membership.partGroup?.id ||
      `fallback:${membership.provenanceBucketLabel || DIRECT_WITHOUT_PATH_LABEL}`;
    const label =
      membership.partGroup?.name || membership.provenanceBucketLabel || DIRECT_WITHOUT_PATH_LABEL;
    const currentBucket = buckets.get(key) || {
      key,
      label,
      memberCount: 0,
      leadershipAssignmentCount: 0,
    };

    currentBucket.memberCount += 1;
    currentBucket.leadershipAssignmentCount += getLeadershipAssignmentCount(membership);
    buckets.set(key, currentBucket);
  }

  const rows = [...buckets.values()];
  const totalMembers = rows.reduce((sum, row) => sum + row.memberCount, 0);
  const totalLeadershipAssignments = rows.reduce(
    (sum, row) => sum + row.leadershipAssignmentCount,
    0
  );

  return rows
    .map(row => ({
      ...row,
      memberPercentage: totalMembers > 0 ? (row.memberCount / totalMembers) * 100 : 0,
      leadershipPercentage:
        totalLeadershipAssignments > 0
          ? (row.leadershipAssignmentCount / totalLeadershipAssignments) * 100
          : 0,
    }))
    .sort(
      (left, right) =>
        right.memberCount - left.memberCount ||
        right.leadershipAssignmentCount - left.leadershipAssignmentCount ||
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
    );
}

function resolveSingleMembershipProvenance<
  TMembership extends MembershipWithCompositionSource,
  TRootMembership extends MembershipWithCompositionSource,
>(args: {
  membership: TMembership;
  currentGroup: MembershipCompositionGroupLike;
  activeRelationships: readonly MembershipCompositionRelationshipLike[];
  groupsById: Map<string, ResolvedMembershipCompositionGroup>;
  activeRootMembershipByKey: Map<string, TRootMembership>;
  activeRootMemberships: readonly TRootMembership[];
}): MembershipProvenanceFields {
  const {
    membership,
    currentGroup,
    activeRelationships,
    groupsById,
    activeRootMembershipByKey,
    activeRootMemberships,
  } = args;
  const explicitProvenance = resolveExplicitMembershipProvenance(membership, groupsById);
  if (explicitProvenance) {
    return explicitProvenance;
  }

  if (isHierarchicalGroup(currentGroup)) {
    return resolveProvenanceWithinRootGroup(
      currentGroup,
      membership,
      activeRelationships,
      groupsById
    );
  }

  if (!isSupportedSiblingGroup(currentGroup)) {
    return createFallbackProvenance();
  }

  const rootGroupId = membership.source_group_id;
  const userId = getMembershipUserId(membership);
  if (!rootGroupId || !userId) {
    return createFallbackProvenance();
  }

  const rootGroup =
    resolveGroupReference(groupsById, rootGroupId, membership.source_group) ||
    normalizeGroup(groupsById.get(rootGroupId), rootGroupId);
  if (!rootGroup) {
    return createFallbackProvenance();
  }

  if (rootGroup.group_type === 'base') {
    return createDirectProvenance(rootGroup);
  }

  const exactRootMembership = activeRootMembershipByKey.get(
    getRootMembershipKey(rootGroupId, userId)
  );
  const compatibleRootMembership =
    exactRootMembership ||
    findCompatibleRootMembership({
      rootGroupId,
      userId,
      activeRootMemberships,
      relationships: activeRelationships,
    });

  if (rootGroup.group_type === 'sibling') {
    return resolveSiblingSourceProvenance({
      sourceGroup: rootGroup,
      sourceMembership: exactRootMembership ?? null,
      userId,
      activeRelationships,
      groupsById,
      activeRootMembershipByKey,
      activeRootMemberships,
    });
  }

  if (!compatibleRootMembership) {
    return createDirectProvenance(rootGroup);
  }

  return resolveProvenanceWithinRootGroup(
    rootGroup,
    compatibleRootMembership,
    activeRelationships,
    groupsById
  );
}

function resolveExplicitMembershipProvenance(
  membership: MembershipWithCompositionSource,
  groupsById: Map<string, ResolvedMembershipCompositionGroup>
): MembershipProvenanceFields | null {
  const primaryOrigin = membership.origins?.[0] ?? null;
  const partGroupId = membership.part_group_id ?? primaryOrigin?.part_group_id ?? null;
  const baseGroupId = membership.base_group_id ?? primaryOrigin?.base_group_id ?? null;

  if (!partGroupId && !baseGroupId) {
    return null;
  }

  const partGroup =
    partGroupId != null
      ? resolveGroupReference(
          groupsById,
          partGroupId,
          membership.part_group ?? primaryOrigin?.part_group ?? null
        )
      : null;
  const baseGroup =
    baseGroupId != null
      ? resolveGroupReference(
          groupsById,
          baseGroupId,
          membership.base_group ?? primaryOrigin?.base_group ?? null
        )
      : null;

  return {
    partGroup: partGroup ?? baseGroup,
    baseGroup: baseGroup ?? partGroup,
    provenanceBucketLabel: null,
  };
}

function resolveSiblingSourceProvenance<
  TRootMembership extends MembershipWithCompositionSource,
>(args: {
  sourceGroup: ResolvedMembershipCompositionGroup;
  sourceMembership: TRootMembership | null;
  userId: string;
  activeRelationships: readonly MembershipCompositionRelationshipLike[];
  groupsById: Map<string, ResolvedMembershipCompositionGroup>;
  activeRootMembershipByKey: Map<string, TRootMembership>;
  activeRootMemberships: readonly TRootMembership[];
}): MembershipProvenanceFields {
  const {
    sourceGroup,
    sourceMembership,
    userId,
    activeRelationships,
    groupsById,
    activeRootMembershipByKey,
    activeRootMemberships,
  } = args;
  const normalizedSourceGroup = normalizeGroup(sourceGroup, sourceGroup.id);

  if (!normalizedSourceGroup) {
    return createFallbackProvenance();
  }

  let baseGroup: MembershipProvenanceGroup = normalizedSourceGroup;
  const nestedSourceGroupId = sourceMembership?.source_group_id;

  if (nestedSourceGroupId && nestedSourceGroupId !== sourceGroup.id) {
    const nestedSourceGroup = resolveGroupReference(
      groupsById,
      nestedSourceGroupId,
      sourceMembership?.source_group
    );

    if (nestedSourceGroup?.group_type === 'base') {
      baseGroup = nestedSourceGroup;
    } else if (nestedSourceGroup && isHierarchicalGroup(nestedSourceGroup)) {
      const nestedMembership =
        activeRootMembershipByKey.get(getRootMembershipKey(nestedSourceGroup.id, userId)) ||
        findCompatibleRootMembership({
          rootGroupId: nestedSourceGroup.id,
          userId,
          activeRootMemberships,
          relationships: activeRelationships,
        });
      const nestedProvenance = nestedMembership
        ? resolveProvenanceWithinRootGroup(
            nestedSourceGroup,
            nestedMembership,
            activeRelationships,
            groupsById
          )
        : null;

      baseGroup = nestedProvenance?.baseGroup ?? nestedSourceGroup;
    } else if (nestedSourceGroup?.group_type === 'sibling') {
      baseGroup = nestedSourceGroup;
    }
  }

  return {
    partGroup: normalizedSourceGroup,
    baseGroup,
    provenanceBucketLabel: null,
  };
}

function findCompatibleRootMembership<
  TRootMembership extends MembershipWithCompositionSource,
>(args: {
  rootGroupId: string;
  userId: string;
  activeRootMemberships: readonly TRootMembership[];
  relationships: readonly MembershipCompositionRelationshipLike[];
}) {
  const { rootGroupId, userId, activeRootMemberships, relationships } = args;

  const matchingMemberships = activeRootMemberships.filter(rootMembership => {
    if (getMembershipUserId(rootMembership) !== userId) {
      return false;
    }

    if (rootMembership.group_id === rootGroupId) {
      return true;
    }

    if (!rootMembership.source_group_id) {
      return false;
    }

    return (
      collectPathsFromBaseToTarget(rootMembership.source_group_id, rootGroupId, relationships)
        .length === 1
    );
  });

  return matchingMemberships.length === 1 ? matchingMemberships[0] : null;
}

function resolveProvenanceWithinRootGroup(
  rootGroup: MembershipCompositionGroupLike,
  membership: MembershipWithCompositionSource,
  activeRelationships: readonly MembershipCompositionRelationshipLike[],
  groupsById: Map<string, ResolvedMembershipCompositionGroup>
): MembershipProvenanceFields {
  if (rootGroup.group_type === 'base') {
    return createDirectProvenance(rootGroup);
  }

  if (!isHierarchicalGroup(rootGroup)) {
    return createFallbackProvenance();
  }

  const baseGroupId = membership.source_group_id;
  if (!baseGroupId) {
    return createFallbackProvenance();
  }

  const baseGroup =
    resolveGroupReference(groupsById, baseGroupId, membership.source_group) ||
    normalizeGroup(groupsById.get(baseGroupId), baseGroupId);
  const partGroup = resolvePartGroupForBase({
    rootGroupId: rootGroup.id,
    baseGroupId,
    relationships: activeRelationships,
    groupsById,
  });

  if (!baseGroup || !partGroup) {
    return createFallbackProvenance();
  }

  return {
    partGroup,
    baseGroup,
    provenanceBucketLabel: null,
  };
}

function createFallbackProvenance(): MembershipProvenanceFields {
  return {
    partGroup: null,
    baseGroup: null,
    provenanceBucketLabel: DIRECT_WITHOUT_PATH_LABEL,
  };
}

function createDirectProvenance(group: MembershipCompositionGroupLike): MembershipProvenanceFields {
  const normalizedGroup = normalizeGroup(group, group.id);
  return {
    partGroup: normalizedGroup,
    baseGroup: normalizedGroup,
    provenanceBucketLabel: null,
  };
}

function resolvePartGroupForBase(args: {
  rootGroupId: string;
  baseGroupId: string;
  relationships: readonly MembershipCompositionRelationshipLike[];
  groupsById: Map<string, ResolvedMembershipCompositionGroup>;
}) {
  const { rootGroupId, baseGroupId, relationships, groupsById } = args;

  if (rootGroupId === baseGroupId) {
    return normalizeGroup(groupsById.get(baseGroupId), baseGroupId);
  }

  const paths = collectPathsFromBaseToTarget(baseGroupId, rootGroupId, relationships);
  if (paths.length !== 1) {
    return null;
  }

  const path = paths[0];
  const partGroupId = path[path.length - 2];
  return partGroupId ? normalizeGroup(groupsById.get(partGroupId), partGroupId) : null;
}

function collectPathsFromBaseToTarget(
  baseGroupId: string,
  targetGroupId: string,
  relationships: readonly MembershipCompositionRelationshipLike[]
) {
  const parentIdsByChildId = new Map<string, string[]>();

  for (const relationship of relationships) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) {
      continue;
    }

    const parentIds = parentIdsByChildId.get(pair.childGroupId) ?? [];
    parentIds.push(pair.parentGroupId);
    parentIdsByChildId.set(pair.childGroupId, parentIds);
  }

  const paths = new Map<string, string[]>();

  const walk = (currentGroupId: string, path: string[]) => {
    const parentIds = parentIdsByChildId.get(currentGroupId) ?? [];

    for (const parentGroupId of parentIds) {
      if (path.includes(parentGroupId)) {
        continue;
      }

      const nextPath = [...path, parentGroupId];
      if (parentGroupId === targetGroupId) {
        paths.set(nextPath.join('>'), nextPath);
        continue;
      }

      walk(parentGroupId, nextPath);
    }
  };

  walk(baseGroupId, [baseGroupId]);
  return [...paths.values()];
}

function buildGroupLookup(
  currentGroup: MembershipCompositionGroupLike,
  memberships: readonly MembershipWithCompositionSource[],
  rootMemberships: readonly MembershipWithCompositionSource[],
  relationships: readonly MembershipCompositionRelationshipLike[]
) {
  const groupsById = new Map<string, ResolvedMembershipCompositionGroup>();

  addGroupToLookup(groupsById, currentGroup);

  for (const relationship of relationships) {
    addGroupToLookup(groupsById, relationship.group);
    addGroupToLookup(groupsById, relationship.related_group);
    addGroupToLookup(groupsById, normalizeGroup(null, relationship.group_id));
    addGroupToLookup(groupsById, normalizeGroup(null, relationship.related_group_id));
  }

  for (const membership of [...memberships, ...rootMemberships]) {
    addGroupToLookup(groupsById, membership.group);
    addGroupToLookup(groupsById, membership.source_group);
    addGroupToLookup(groupsById, membership.part_group);
    addGroupToLookup(groupsById, membership.base_group);
    addGroupToLookup(groupsById, normalizeGroup(null, membership.part_group_id));
    addGroupToLookup(groupsById, normalizeGroup(null, membership.base_group_id));
    for (const origin of membership.origins ?? []) {
      addGroupToLookup(groupsById, origin.source_group);
      addGroupToLookup(groupsById, origin.part_group);
      addGroupToLookup(groupsById, origin.base_group);
      addGroupToLookup(groupsById, normalizeGroup(null, origin.source_group_id));
      addGroupToLookup(groupsById, normalizeGroup(null, origin.part_group_id));
      addGroupToLookup(groupsById, normalizeGroup(null, origin.base_group_id));
    }
  }

  applyRelationshipDerivedGroupTypes(groupsById, relationships);

  return groupsById;
}

function applyRelationshipDerivedGroupTypes(
  groupsById: Map<string, ResolvedMembershipCompositionGroup>,
  relationships: readonly MembershipCompositionRelationshipLike[]
) {
  const parentGroupIds = new Set<string>();
  const peerGroupIds = new Set<string>();

  for (const relationship of relationships) {
    if (relationship.status !== 'active') {
      continue;
    }

    const hierarchyPair = getHierarchyRelationshipPair(relationship);
    if (hierarchyPair) {
      parentGroupIds.add(hierarchyPair.parentGroupId);
      addGroupToLookup(groupsById, normalizeGroup(null, hierarchyPair.parentGroupId));
      addGroupToLookup(groupsById, normalizeGroup(null, hierarchyPair.childGroupId));
      continue;
    }

    if (relationship.connection_type === 'peer' || relationship.relationship_type === 'sibling') {
      peerGroupIds.add(relationship.group_id);
      peerGroupIds.add(relationship.related_group_id);
    }
  }

  for (const [groupId, group] of groupsById) {
    const inferredGroupType = parentGroupIds.has(groupId)
      ? 'hierarchical'
      : peerGroupIds.has(groupId)
        ? 'sibling'
        : 'base';

    groupsById.set(groupId, {
      ...group,
      group_type:
        group.group_type === 'hierarchical' || group.group_type === 'sibling'
          ? group.group_type
          : inferredGroupType,
    });
  }
}

function addGroupToLookup(
  groupsById: Map<string, ResolvedMembershipCompositionGroup>,
  group: ParticipationGroupLike | MembershipCompositionGroupLike | null | undefined
) {
  const normalizedGroup = normalizeGroup(group);
  if (!normalizedGroup) {
    return;
  }

  groupsById.set(normalizedGroup.id, normalizedGroup);
}

function normalizeGroup(
  group: ParticipationGroupLike | MembershipCompositionGroupLike | null | undefined,
  fallbackId?: string | null
): ResolvedMembershipCompositionGroup | null {
  const id = group?.id || fallbackId;
  if (!id) {
    return null;
  }

  const extendedGroup = group as MembershipCompositionGroupLike | null | undefined;

  return {
    id,
    name: group?.name || id,
    group_type: group?.group_type ?? null,
    connected_group_id: extendedGroup?.connected_group_id ?? null,
    sibling_membership_mode: extendedGroup?.sibling_membership_mode ?? null,
  };
}

function resolveGroupReference(
  groupsById: Map<string, ResolvedMembershipCompositionGroup>,
  groupId: string,
  group?: ParticipationGroupLike | MembershipCompositionGroupLike | null
): ResolvedMembershipCompositionGroup | null {
  const lookupGroup = groupsById.get(groupId) ?? null;
  const normalizedGroup = normalizeGroup(group, groupId);

  if (!lookupGroup) {
    return normalizedGroup;
  }

  if (!normalizedGroup) {
    return lookupGroup;
  }

  return {
    ...lookupGroup,
    ...normalizedGroup,
    group_type: lookupGroup.group_type ?? normalizedGroup.group_type,
    connected_group_id: normalizedGroup.connected_group_id ?? lookupGroup.connected_group_id,
    sibling_membership_mode:
      normalizedGroup.sibling_membership_mode ?? lookupGroup.sibling_membership_mode,
  };
}

function isActivePassiveVotingRelationship(relationship: MembershipCompositionRelationshipLike) {
  return (
    relationship.status === 'active' &&
    relationship.relationship_type !== 'sibling' &&
    (relationship.with_right == null || relationship.with_right === 'passiveVotingRight')
  );
}

function isActiveMembership(membership: MembershipWithCompositionSource) {
  const status = membership.status?.toLowerCase() || '';
  if (status === 'active' || status === 'admin' || status === 'member') {
    return true;
  }

  return getMembershipDisplayRoles(membership).some(
    role => (role.name || '').toLowerCase() === 'board member'
  );
}

function getMembershipUserId(membership: MembershipWithCompositionSource) {
  return membership.user?.id || membership.user_id || null;
}

function getRootMembershipKey(rootGroupId: string, userId: string) {
  return `${rootGroupId}:${userId}`;
}

function getLeadershipAssignmentCount(membership: Pick<ParticipationLike, 'roles' | 'role'>) {
  const roles =
    membership.roles && membership.roles.length > 0
      ? membership.roles
      : membership.role
        ? [membership.role]
        : [];

  return roles.filter(role => (role.name || '').toLowerCase() !== 'member').length;
}
