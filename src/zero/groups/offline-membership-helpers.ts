import { resolveHierarchicalAncestors } from '@/features/groups/logic/hierarchy';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { isActiveGroupStatus } from '../server-helpers';
import { zql } from '../schema';
import { buildGroupsById, filterHierarchyRelationships } from './membership-helpers';
import {
  HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from './membership-source-constants';

type ZeroTransactionLike = Pick<ZeroTransaction, 'run' | 'mutate'>;

type OfflineMembershipSource =
  | 'direct'
  | typeof HIERARCHY_DERIVED_MEMBERSHIP_SOURCE
  | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
  | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;

const SIBLING_AUTOMATIC_OFFLINE_SOURCES = new Set<string>([
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
]);

function normalizeSourceGroupId(sourceGroupId: string | null | undefined) {
  return sourceGroupId ?? null;
}

export function buildOfflineMembershipPersonKey(args: {
  offlineMemberId?: string | null;
  connectedUserId?: string | null;
}) {
  if (args.connectedUserId) {
    return null;
  }

  return args.offlineMemberId ? `offline:${args.offlineMemberId}` : null;
}

export function isManualOfflineMembershipSource(source: string | null | undefined) {
  return source === 'direct';
}

export function isAutomaticOfflineMembershipSource(source: string | null | undefined) {
  return (
    source === HIERARCHY_DERIVED_MEMBERSHIP_SOURCE ||
    (source != null && SIBLING_AUTOMATIC_OFFLINE_SOURCES.has(source))
  );
}

function isEffectiveOfflineMembership(membership: {
  status?: string | null;
  group_offline_member?: { connected_user_id?: string | null } | null;
}) {
  return (
    isActiveGroupStatus(membership.status) && !membership.group_offline_member?.connected_user_id
  );
}

async function loadOfflineMembershipsWithMembersForGroup(tx: ZeroTransactionLike, groupId: string) {
  return tx.run(
    zql.group_offline_membership
      .where('group_id', groupId)
      .related('group_offline_member', query =>
        query.related('group').related('connected_user').related('created_by')
      )
      .related('group')
      .related('source_group')
  );
}

async function loadOfflineMembershipsWithMembersByGroupIds(
  tx: ZeroTransactionLike,
  groupIds: readonly string[]
) {
  if (groupIds.length === 0) {
    return [];
  }

  return tx.run(
    zql.group_offline_membership
      .where('group_id', 'IN', [...new Set(groupIds)])
      .related('group_offline_member', query =>
        query.related('group').related('connected_user').related('created_by')
      )
      .related('group')
      .related('source_group')
  );
}

async function loadActiveOfflineMembershipsForGroup(tx: ZeroTransactionLike, groupId: string) {
  return (await loadOfflineMembershipsWithMembersForGroup(tx, groupId)).filter(
    isEffectiveOfflineMembership
  );
}

async function getActiveOfflineMembersForGroupRole(
  tx: ZeroTransactionLike,
  groupId: string,
  roleId: string
) {
  const links = await tx.run(zql.group_offline_membership_role.where('role_id', roleId));
  if (links.length === 0) {
    return [];
  }

  const membershipIds = links.map(link => link.group_offline_membership_id);
  const memberships = await tx.run(
    zql.group_offline_membership
      .where('id', 'IN', membershipIds)
      .related('group_offline_member', query =>
        query.related('group').related('connected_user').related('created_by')
      )
      .related('group')
      .related('source_group')
  );

  const linkedMembershipIds = new Set(links.map(link => link.group_offline_membership_id));
  return memberships.filter(
    membership =>
      membership.group_id === groupId &&
      linkedMembershipIds.has(membership.id) &&
      isEffectiveOfflineMembership(membership)
  );
}

function getSiblingAutomaticSourceForMode(mode: string | null | undefined) {
  return mode === 'elected'
    ? SIBLING_ELECTED_MEMBERSHIP_SOURCE
    : mode === 'parliament'
      ? SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE
      : null;
}

function getOfflineMembershipKey(groupId: string, groupOfflineMemberId: string) {
  return `${groupId}:${groupOfflineMemberId}`;
}

async function upsertOfflineMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    groupOfflineMemberId: string;
    status?: string | null;
    visibility?: string;
    source: OfflineMembershipSource;
    sourceGroupId?: string | null;
  }
) {
  const existingMembership = await tx.run(
    zql.group_offline_membership
      .where('group_id', args.groupId)
      .where('group_offline_member_id', args.groupOfflineMemberId)
      .one()
  );

  const normalizedSourceGroupId = normalizeSourceGroupId(args.sourceGroupId);
  const nextStatus = args.status ?? 'active';
  const nextVisibility = args.visibility ?? 'public';

  if (existingMembership) {
    const patch: {
      id: string;
      status?: string | null;
      visibility?: string;
      source?: string;
      source_group_id?: string | null;
    } = { id: existingMembership.id };

    if (existingMembership.status !== nextStatus) {
      patch.status = nextStatus;
    }

    if (existingMembership.visibility !== nextVisibility) {
      patch.visibility = nextVisibility;
    }

    if (existingMembership.source !== args.source) {
      patch.source = args.source;
    }

    if (normalizeSourceGroupId(existingMembership.source_group_id) !== normalizedSourceGroupId) {
      patch.source_group_id = normalizedSourceGroupId;
    }

    if (Object.keys(patch).length > 1) {
      await tx.mutate.group_offline_membership.update(patch);
    }

    return existingMembership.id;
  }

  const membershipId = crypto.randomUUID();
  await tx.mutate.group_offline_membership.insert({
    id: membershipId,
    group_offline_member_id: args.groupOfflineMemberId,
    group_id: args.groupId,
    status: nextStatus,
    visibility: nextVisibility,
    source: args.source,
    source_group_id: normalizedSourceGroupId,
    created_at: Date.now(),
  });

  return membershipId;
}

export async function ensureOfflineDirectMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    groupOfflineMemberId: string;
  }
) {
  return upsertOfflineMembership(tx, {
    groupId: args.groupId,
    groupOfflineMemberId: args.groupOfflineMemberId,
    status: 'active',
    visibility: 'public',
    source: 'direct',
    sourceGroupId: null,
  });
}

async function upsertHierarchyDerivedOfflineMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    groupOfflineMemberId: string;
    baseGroupId: string;
  }
) {
  return upsertOfflineMembership(tx, {
    groupId: args.groupId,
    groupOfflineMemberId: args.groupOfflineMemberId,
    status: 'active',
    visibility: 'public',
    source: HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
    sourceGroupId: args.baseGroupId,
  });
}

async function upsertAutomaticSiblingOfflineMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    groupOfflineMemberId: string;
    source: typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
    sourceGroupId?: string | null;
  }
) {
  return upsertOfflineMembership(tx, {
    groupId: args.groupId,
    groupOfflineMemberId: args.groupOfflineMemberId,
    status: 'active',
    visibility: 'public',
    source: args.source,
    sourceGroupId: args.sourceGroupId ?? null,
  });
}

async function getDesiredOfflineSiblingMembershipSources(
  tx: ZeroTransactionLike,
  group: {
    id: string;
    connected_group_id?: string | null;
    sibling_membership_mode?: string | null;
    sibling_role_id?: string | null;
  }
) {
  if (!group.connected_group_id || !group.sibling_membership_mode) {
    return new Map<string, string | null>();
  }

  if (group.sibling_membership_mode === 'open') {
    return new Map<string, string | null>();
  }

  const connectedMemberships = await loadActiveOfflineMembershipsForGroup(
    tx,
    group.connected_group_id
  );
  const connectedOfflineMemberIds = new Set(
    connectedMemberships.map(membership => membership.group_offline_member_id)
  );

  if (group.sibling_membership_mode === 'elected') {
    if (!group.sibling_role_id) {
      return new Map<string, string | null>();
    }

    const memberships = await getActiveOfflineMembersForGroupRole(
      tx,
      group.connected_group_id,
      group.sibling_role_id
    );

    return new Map(
      memberships.map(membership => [membership.group_offline_member_id, group.connected_group_id])
    );
  }

  const siblingSources = await tx.run(zql.group_sibling_source.where('group_id', group.id));
  if (siblingSources.length === 0) {
    return new Map<string, string | null>();
  }

  const sourceGroupsByOfflineMemberId = new Map<string, Set<string>>();
  for (const siblingSource of siblingSources) {
    const sourceMemberships = await loadActiveOfflineMembershipsForGroup(
      tx,
      siblingSource.source_group_id
    );
    for (const membership of sourceMemberships) {
      const sourceGroupIds =
        sourceGroupsByOfflineMemberId.get(membership.group_offline_member_id) ?? new Set<string>();
      sourceGroupIds.add(siblingSource.source_group_id);
      sourceGroupsByOfflineMemberId.set(membership.group_offline_member_id, sourceGroupIds);
    }
  }

  const desiredMembershipSources = new Map<string, string | null>();
  for (const [groupOfflineMemberId, sourceGroupIds] of sourceGroupsByOfflineMemberId.entries()) {
    if (!connectedOfflineMemberIds.has(groupOfflineMemberId) || sourceGroupIds.size !== 1) {
      continue;
    }

    desiredMembershipSources.set(groupOfflineMemberId, [...sourceGroupIds][0] ?? null);
  }

  return desiredMembershipSources;
}

export async function loadEffectiveOfflineMembershipsForGroup(
  tx: ZeroTransactionLike,
  groupId: string
) {
  return loadActiveOfflineMembershipsForGroup(tx, groupId);
}

export async function loadEffectiveOfflineMembershipsByGroupIds(
  tx: ZeroTransactionLike,
  groupIds: readonly string[]
) {
  return (await loadOfflineMembershipsWithMembersByGroupIds(tx, groupIds)).filter(
    isEffectiveOfflineMembership
  );
}

export async function clearAutomaticOfflineSiblingMemberships(
  tx: ZeroTransactionLike,
  groupId: string
) {
  const existingMemberships = await tx.run(zql.group_offline_membership.where('group_id', groupId));

  for (const membership of existingMemberships) {
    if (!SIBLING_AUTOMATIC_OFFLINE_SOURCES.has(membership.source)) {
      continue;
    }

    await tx.mutate.group_offline_membership.delete({ id: membership.id });
  }
}

export async function recomputeOfflineSiblingGroupMemberships(
  tx: ZeroTransactionLike,
  groupId: string
) {
  const group = await tx.run(zql.group.where('id', groupId).one());
  if (!group || group.group_type !== 'sibling' || !group.connected_group_id) {
    return new Set<string>();
  }

  const existingMemberships = await tx.run(zql.group_offline_membership.where('group_id', groupId));
  const automaticSource = getSiblingAutomaticSourceForMode(group.sibling_membership_mode);

  if (!automaticSource) {
    await clearAutomaticOfflineSiblingMemberships(tx, groupId);
    return new Set<string>([groupId]);
  }

  const desiredMembershipSources = await getDesiredOfflineSiblingMembershipSources(tx, group);

  for (const membership of existingMemberships) {
    if (!isAutomaticOfflineMembershipSource(membership.source)) {
      continue;
    }

    const expectedSourceGroupId =
      desiredMembershipSources.get(membership.group_offline_member_id) ?? null;
    const shouldExist = desiredMembershipSources.has(membership.group_offline_member_id);
    const canKeep =
      shouldExist &&
      membership.source === automaticSource &&
      normalizeSourceGroupId(membership.source_group_id) === expectedSourceGroupId &&
      isActiveGroupStatus(membership.status);

    if (!canKeep) {
      await tx.mutate.group_offline_membership.delete({ id: membership.id });
    }
  }

  for (const [groupOfflineMemberId, sourceGroupId] of desiredMembershipSources.entries()) {
    await upsertAutomaticSiblingOfflineMembership(tx, {
      groupId,
      groupOfflineMemberId,
      source: automaticSource,
      sourceGroupId,
    });
  }

  return new Set<string>([groupId]);
}

export async function recomputeOfflineSiblingMembershipsForGroup(
  tx: ZeroTransactionLike,
  groupId: string
) {
  const queue = [groupId];
  const visitedGroups = new Set<string>();
  const recomputedSiblingGroups = new Set<string>();

  while (queue.length > 0) {
    const currentGroupId = queue.shift();
    if (!currentGroupId || visitedGroups.has(currentGroupId)) {
      continue;
    }

    visitedGroups.add(currentGroupId);

    const [directlyConnectedSiblingGroups, sourceLinks] = await Promise.all([
      tx.run(zql.group.where('connected_group_id', currentGroupId).where('group_type', 'sibling')),
      tx.run(zql.group_sibling_source.where('source_group_id', currentGroupId)),
    ]);

    const siblingGroupIds = new Set<string>(directlyConnectedSiblingGroups.map(group => group.id));
    for (const sourceLink of sourceLinks) {
      siblingGroupIds.add(sourceLink.group_id);
    }

    for (const siblingGroupId of siblingGroupIds) {
      if (!recomputedSiblingGroups.has(siblingGroupId)) {
        const affectedGroupIds = await recomputeOfflineSiblingGroupMemberships(tx, siblingGroupId);
        for (const affectedGroupId of affectedGroupIds) {
          recomputedSiblingGroups.add(affectedGroupId);
        }
      }
      queue.push(siblingGroupId);
    }
  }

  return recomputedSiblingGroups;
}

export async function reconcileOfflineHierarchyForBaseGroup(
  tx: ZeroTransactionLike,
  baseGroupId: string
) {
  const groupsById = await buildGroupsById(tx);
  const rawRelationships = await tx.run(
    zql.group_relationship.where('with_right', 'passiveVotingRight').where('status', 'active')
  );
  const hierarchyRelationships = filterHierarchyRelationships(rawRelationships, groupsById);
  const ancestorGroupIds = resolveHierarchicalAncestors(
    baseGroupId,
    hierarchyRelationships,
    groupsById
  );
  const activeDirectMemberships = (
    await tx.run(
      zql.group_offline_membership
        .where('group_id', baseGroupId)
        .where('source', 'direct')
        .related('group_offline_member', query =>
          query.related('group').related('connected_user').related('created_by')
        )
    )
  ).filter(isEffectiveOfflineMembership);
  const existingDerivedMemberships = await tx.run(
    zql.group_offline_membership
      .where('source', HIERARCHY_DERIVED_MEMBERSHIP_SOURCE)
      .where('source_group_id', baseGroupId)
  );
  const desiredKeys = new Set<string>();
  const affectedGroupIds = new Set<string>(ancestorGroupIds);

  for (const membership of activeDirectMemberships) {
    for (const ancestorGroupId of ancestorGroupIds) {
      desiredKeys.add(getOfflineMembershipKey(ancestorGroupId, membership.group_offline_member_id));
    }
  }

  for (const existingDerivedMembership of existingDerivedMemberships) {
    const membershipKey = getOfflineMembershipKey(
      existingDerivedMembership.group_id,
      existingDerivedMembership.group_offline_member_id
    );

    if (desiredKeys.has(membershipKey)) {
      continue;
    }

    await tx.mutate.group_offline_membership.delete({ id: existingDerivedMembership.id });
    affectedGroupIds.add(existingDerivedMembership.group_id);
  }

  const existingDerivedKeys = new Set(
    existingDerivedMemberships.map(existingDerivedMembership =>
      getOfflineMembershipKey(
        existingDerivedMembership.group_id,
        existingDerivedMembership.group_offline_member_id
      )
    )
  );

  for (const membership of activeDirectMemberships) {
    for (const ancestorGroupId of ancestorGroupIds) {
      const membershipKey = getOfflineMembershipKey(
        ancestorGroupId,
        membership.group_offline_member_id
      );

      if (existingDerivedKeys.has(membershipKey)) {
        continue;
      }

      await upsertHierarchyDerivedOfflineMembership(tx, {
        groupId: ancestorGroupId,
        groupOfflineMemberId: membership.group_offline_member_id,
        baseGroupId,
      });
      affectedGroupIds.add(ancestorGroupId);
    }
  }

  return {
    affectedGroupIds,
  };
}
