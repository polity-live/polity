import { zql } from '../schema';
import type { ZeroTransaction } from '@/server/zero-mutate';
import {
  isActiveGroupStatus,
  recomputeGroupCounters,
  recomputeUserCounters,
  syncUserWithGroupConversation,
} from '../server-helpers';
import { resolveHierarchicalAncestors } from '@/features/groups/logic/hierarchy';
import {
  HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from './membership-source-constants';

type ZeroTransactionLike = Pick<ZeroTransaction, 'run' | 'mutate'>;
type ServerHelperTx = Parameters<typeof recomputeGroupCounters>[0];

function asServerHelperTx(tx: ZeroTransactionLike) {
  return tx as ServerHelperTx;
}

const SIBLING_AUTOMATIC_SOURCES = new Set([
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
]);

export function isSiblingAutomaticMembershipSource(source: string | null | undefined) {
  return source != null && SIBLING_AUTOMATIC_SOURCES.has(source);
}

export function isAutomaticGroupMembershipSource(source: string | null | undefined) {
  return (
    source === HIERARCHY_DERIVED_MEMBERSHIP_SOURCE || isSiblingAutomaticMembershipSource(source)
  );
}

export function isManualGroupMembershipSource(source: string | null | undefined) {
  return source === 'direct';
}

export function isSiblingGroupType(groupType: string | null | undefined) {
  return groupType === 'sibling';
}

export function filterHierarchyRelationships<
  T extends { group_id: string; related_group_id: string },
>(
  relationships: readonly T[],
  groupsById: ReadonlyMap<string, { group_type?: string | null | undefined }>
) {
  return relationships.filter(relationship => {
    const sourceGroupType = groupsById.get(relationship.group_id)?.group_type ?? null;
    const relatedGroupType = groupsById.get(relationship.related_group_id)?.group_type ?? null;
    return sourceGroupType !== 'sibling' && relatedGroupType !== 'sibling';
  });
}

export async function buildGroupsById(
  tx: ZeroTransactionLike,
  groupIds?: readonly string[]
): Promise<Map<string, { id: string; group_type?: string | null }>> {
  const groups =
    groupIds && groupIds.length > 0
      ? await tx.run(zql.group.where('id', 'IN', [...new Set(groupIds)]))
      : await tx.run(zql.group);

  return new Map(groups.map(group => [group.id, group]));
}

async function addGroupMembershipRoleLink(
  tx: ZeroTransactionLike,
  args: {
    group_membership_id: string;
    role_id: string;
    assigned_by_id?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.group_membership_role
      .where('group_membership_id', args.group_membership_id)
      .where('role_id', args.role_id)
      .one()
  );

  if (existingLink) {
    return existingLink.id;
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  await tx.mutate.group_membership_role.insert({
    id,
    group_membership_id: args.group_membership_id,
    role_id: args.role_id,
    assigned_at: now,
    assigned_by_id: args.assigned_by_id ?? null,
    created_at: now,
  });

  return id;
}

async function getMemberRoleId(tx: ZeroTransactionLike, groupId: string) {
  const roles = await tx.run(zql.role.where('group_id', groupId).where('scope', 'group'));
  return roles.find(role => role.name === 'Member' && role.assignee_kind !== 'guest')?.id ?? null;
}

async function ensureMemberRoleLink(
  tx: ZeroTransactionLike,
  groupMembershipId: string,
  groupId: string,
  assignedById?: string | null
) {
  const memberRoleId = await getMemberRoleId(tx, groupId);
  if (!memberRoleId) {
    return;
  }

  await addGroupMembershipRoleLink(tx, {
    group_membership_id: groupMembershipId,
    role_id: memberRoleId,
    assigned_by_id: assignedById,
  });
}

async function getActiveUserIdsForGroup(tx: ZeroTransactionLike, groupId: string) {
  const memberships = await tx.run(zql.group_membership.where('group_id', groupId));
  return new Set(
    memberships
      .filter(membership => isActiveGroupStatus(membership.status))
      .map(membership => membership.user_id)
  );
}

async function getActiveUsersForGroupRole(
  tx: ZeroTransactionLike,
  groupId: string,
  roleId: string
) {
  const links = await tx.run(zql.group_membership_role.where('role_id', roleId));
  if (links.length === 0) {
    return new Set<string>();
  }

  const membershipIds = links.map(link => link.group_membership_id);
  const memberships = await tx.run(zql.group_membership.where('id', 'IN', membershipIds));

  return new Set(
    memberships
      .filter(
        membership =>
          membership.group_id === groupId &&
          isActiveGroupStatus(membership.status) &&
          links.some(link => link.group_membership_id === membership.id)
      )
      .map(membership => membership.user_id)
  );
}

async function getDesiredSiblingMembershipSources(
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

  const connectedMemberIds = await getActiveUserIdsForGroup(tx, group.connected_group_id);

  if (group.sibling_membership_mode === 'open') {
    return new Map([...connectedMemberIds].map(userId => [userId, group.connected_group_id]));
  }

  if (group.sibling_membership_mode === 'elected') {
    if (!group.sibling_role_id) {
      return new Map<string, string | null>();
    }
    const userIds = await getActiveUsersForGroupRole(
      tx,
      group.connected_group_id,
      group.sibling_role_id
    );
    return new Map([...userIds].map(userId => [userId, group.connected_group_id]));
  }

  const siblingSources = await tx.run(zql.group_sibling_source.where('group_id', group.id));
  if (siblingSources.length === 0) {
    return new Map<string, string | null>();
  }

  const sourceGroupsByUserId = new Map<string, Set<string>>();
  for (const siblingSource of siblingSources) {
    const sourceMemberIds = await getActiveUserIdsForGroup(tx, siblingSource.source_group_id);
    for (const userId of sourceMemberIds) {
      const sourceGroupIds = sourceGroupsByUserId.get(userId) ?? new Set<string>();
      sourceGroupIds.add(siblingSource.source_group_id);
      sourceGroupsByUserId.set(userId, sourceGroupIds);
    }
  }

  const desiredMembershipSources = new Map<string, string | null>();
  for (const [userId, sourceGroupIds] of sourceGroupsByUserId.entries()) {
    if (!connectedMemberIds.has(userId) || sourceGroupIds.size !== 1) {
      continue;
    }

    desiredMembershipSources.set(userId, [...sourceGroupIds][0] ?? null);
  }

  return desiredMembershipSources;
}

async function upsertAutomaticSiblingMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    userId: string;
    source: typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
    sourceGroupId?: string | null;
    assignedById?: string | null;
  }
) {
  const existingMembership = await tx.run(
    zql.group_membership.where('group_id', args.groupId).where('user_id', args.userId).one()
  );

  if (existingMembership) {
    const patch: {
      id: string;
      status?: string | null;
      visibility?: string;
      source?: string;
      source_group_id?: string | null;
    } = { id: existingMembership.id };

    if (existingMembership.status !== 'active') {
      patch.status = 'active';
    }

    if (existingMembership.visibility !== 'public') {
      patch.visibility = 'public';
    }

    if (existingMembership.source !== args.source) {
      patch.source = args.source;
    }

    const normalizedSourceGroupId = args.sourceGroupId ?? null;
    if (existingMembership.source_group_id !== normalizedSourceGroupId) {
      patch.source_group_id = normalizedSourceGroupId;
    }

    if (Object.keys(patch).length > 1) {
      await tx.mutate.group_membership.update(patch);
    }

    await ensureMemberRoleLink(tx, existingMembership.id, args.groupId, args.assignedById);
    return existingMembership.id;
  }

  const membershipId = crypto.randomUUID();

  await tx.mutate.group_membership.insert({
    id: membershipId,
    group_id: args.groupId,
    user_id: args.userId,
    status: 'active',
    visibility: 'public',
    source: args.source,
    source_group_id: args.sourceGroupId ?? null,
    created_at: Date.now(),
  });

  await ensureMemberRoleLink(tx, membershipId, args.groupId, args.assignedById);
  return membershipId;
}

async function upsertHierarchyDerivedMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    userId: string;
    baseGroupId: string;
    assignedById?: string | null;
  }
) {
  const existingMembership = await tx.run(
    zql.group_membership.where('group_id', args.groupId).where('user_id', args.userId).one()
  );

  if (existingMembership) {
    const patch: {
      id: string;
      status?: string | null;
      visibility?: string;
      source?: string;
      source_group_id?: string | null;
    } = { id: existingMembership.id };

    if (existingMembership.status !== 'active') {
      patch.status = 'active';
    }

    if (existingMembership.visibility !== 'public') {
      patch.visibility = 'public';
    }

    if (existingMembership.source !== HIERARCHY_DERIVED_MEMBERSHIP_SOURCE) {
      patch.source = HIERARCHY_DERIVED_MEMBERSHIP_SOURCE;
    }

    if (existingMembership.source_group_id !== args.baseGroupId) {
      patch.source_group_id = args.baseGroupId;
    }

    if (Object.keys(patch).length > 1) {
      await tx.mutate.group_membership.update(patch);
    }

    await ensureMemberRoleLink(tx, existingMembership.id, args.groupId, args.assignedById);
    return existingMembership.id;
  }

  const membershipId = crypto.randomUUID();

  await tx.mutate.group_membership.insert({
    id: membershipId,
    group_id: args.groupId,
    user_id: args.userId,
    status: 'active',
    visibility: 'public',
    source: HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
    source_group_id: args.baseGroupId,
    created_at: Date.now(),
  });

  await ensureMemberRoleLink(tx, membershipId, args.groupId, args.assignedById);
  return membershipId;
}

function getSiblingAutomaticSourceForMode(mode: string | null | undefined) {
  return mode === 'elected'
    ? SIBLING_ELECTED_MEMBERSHIP_SOURCE
    : mode === 'parliament'
      ? SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE
      : null;
}

export async function recomputeSiblingGroupMemberships(
  tx: ZeroTransactionLike,
  groupId: string,
  assignedById?: string | null
) {
  const group = await tx.run(zql.group.where('id', groupId).one());
  if (!group || group.group_type !== 'sibling' || !group.connected_group_id) {
    return;
  }

  const existingMemberships = await tx.run(zql.group_membership.where('group_id', groupId));
  const affectedUserIds = new Set(existingMemberships.map(membership => membership.user_id));
  const connectedActiveUserIds = await getActiveUserIdsForGroup(tx, group.connected_group_id);

  if (group.sibling_membership_mode === 'open') {
    for (const membership of existingMemberships) {
      const shouldKeepManualMembership =
        isManualGroupMembershipSource(membership.source) &&
        connectedActiveUserIds.has(membership.user_id);

      if (!shouldKeepManualMembership) {
        await tx.mutate.group_membership.delete({ id: membership.id });
      }
    }

    await recomputeGroupCounters(asServerHelperTx(tx), groupId);
    for (const userId of affectedUserIds) {
      await recomputeUserCounters(asServerHelperTx(tx), userId);
      await syncUserWithGroupConversation(asServerHelperTx(tx), { groupId, userId });
    }
    return;
  }

  const desiredMembershipSources = await getDesiredSiblingMembershipSources(tx, group);
  const automaticSource = getSiblingAutomaticSourceForMode(group.sibling_membership_mode);
  if (!automaticSource) {
    return;
  }

  for (const membership of existingMemberships) {
    const expectedSourceGroupId = desiredMembershipSources.get(membership.user_id) ?? null;
    const shouldExist = desiredMembershipSources.has(membership.user_id);
    const canKeep =
      shouldExist &&
      membership.source === automaticSource &&
      membership.status === 'active' &&
      membership.source_group_id === expectedSourceGroupId;

    if (!canKeep) {
      await tx.mutate.group_membership.delete({ id: membership.id });
    }
  }

  for (const [userId, sourceGroupId] of desiredMembershipSources.entries()) {
    affectedUserIds.add(userId);
    await upsertAutomaticSiblingMembership(tx, {
      groupId,
      userId,
      source: automaticSource,
      sourceGroupId,
      assignedById,
    });
  }

  await recomputeGroupCounters(asServerHelperTx(tx), groupId);
  for (const userId of affectedUserIds) {
    await recomputeUserCounters(asServerHelperTx(tx), userId);
    await syncUserWithGroupConversation(asServerHelperTx(tx), { groupId, userId });
  }
}

export async function recomputeSiblingMembershipsForGroup(
  tx: ZeroTransactionLike,
  groupId: string,
  assignedById?: string | null
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
        await recomputeSiblingGroupMemberships(tx, siblingGroupId, assignedById);
        recomputedSiblingGroups.add(siblingGroupId);
      }
      queue.push(siblingGroupId);
    }
  }

  return recomputedSiblingGroups;
}

export async function clearAutomaticSiblingMemberships(tx: ZeroTransactionLike, groupId: string) {
  const existingMemberships = await tx.run(zql.group_membership.where('group_id', groupId));
  const affectedUserIds = new Set<string>();

  for (const membership of existingMemberships) {
    if (!isSiblingAutomaticMembershipSource(membership.source)) {
      continue;
    }

    affectedUserIds.add(membership.user_id);
    await tx.mutate.group_membership.delete({ id: membership.id });
  }

  if (affectedUserIds.size === 0) {
    return;
  }

  await recomputeGroupCounters(asServerHelperTx(tx), groupId);
  for (const userId of affectedUserIds) {
    await recomputeUserCounters(asServerHelperTx(tx), userId);
    await syncUserWithGroupConversation(asServerHelperTx(tx), { groupId, userId });
  }
}

export async function reconcileHierarchyForBaseGroup(
  tx: ZeroTransactionLike,
  baseGroupId: string,
  assignedById?: string | null
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
    await tx.run(zql.group_membership.where('group_id', baseGroupId).where('source', 'direct'))
  ).filter(membership => isActiveGroupStatus(membership.status));
  const existingDerivedMemberships = await tx.run(
    zql.group_membership
      .where('source', HIERARCHY_DERIVED_MEMBERSHIP_SOURCE)
      .where('source_group_id', baseGroupId)
  );
  const desiredKeys = new Set<string>();
  const affectedGroupIds = new Set<string>(ancestorGroupIds);
  const affectedUserIds = new Set<string>();
  const touchedConversationPairs = new Set<string>();

  for (const membership of activeDirectMemberships) {
    affectedUserIds.add(membership.user_id);
    for (const ancestorGroupId of ancestorGroupIds) {
      desiredKeys.add(`${ancestorGroupId}:${membership.user_id}`);
    }
  }

  for (const existingDerivedMembership of existingDerivedMemberships) {
    affectedUserIds.add(existingDerivedMembership.user_id);
    const membershipKey = `${existingDerivedMembership.group_id}:${existingDerivedMembership.user_id}`;

    if (desiredKeys.has(membershipKey)) {
      continue;
    }

    await tx.mutate.group_membership.delete({ id: existingDerivedMembership.id });
    affectedGroupIds.add(existingDerivedMembership.group_id);
    touchedConversationPairs.add(
      `${existingDerivedMembership.group_id}:${existingDerivedMembership.user_id}`
    );
  }

  const existingDerivedKeys = new Set(
    existingDerivedMemberships.map(
      existingDerivedMembership =>
        `${existingDerivedMembership.group_id}:${existingDerivedMembership.user_id}`
    )
  );

  for (const membership of activeDirectMemberships) {
    for (const ancestorGroupId of ancestorGroupIds) {
      const membershipKey = `${ancestorGroupId}:${membership.user_id}`;

      if (existingDerivedKeys.has(membershipKey)) {
        continue;
      }

      await upsertHierarchyDerivedMembership(tx, {
        groupId: ancestorGroupId,
        userId: membership.user_id,
        baseGroupId,
        assignedById,
      });
      affectedGroupIds.add(ancestorGroupId);
      touchedConversationPairs.add(`${ancestorGroupId}:${membership.user_id}`);
    }
  }

  for (const affectedGroupId of affectedGroupIds) {
    await recomputeGroupCounters(asServerHelperTx(tx), affectedGroupId);
  }

  for (const affectedUserId of affectedUserIds) {
    await recomputeUserCounters(asServerHelperTx(tx), affectedUserId);
  }

  for (const touchedPair of touchedConversationPairs) {
    const [groupId, userId] = touchedPair.split(':');
    if (!groupId || !userId) {
      continue;
    }

    await syncUserWithGroupConversation(asServerHelperTx(tx), {
      groupId,
      userId,
    });
  }

  return {
    affectedGroupIds,
    affectedUserIds,
  };
}

export async function userHasActiveMembershipInGroup(
  tx: ZeroTransactionLike,
  userId: string,
  groupId: string
) {
  const memberships = await tx.run(
    zql.group_membership.where('group_id', groupId).where('user_id', userId)
  );
  return memberships.some(membership => isActiveGroupStatus(membership.status));
}

export async function assertValidSiblingConfiguration(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    groupType: string;
    connectedGroupId?: string | null;
    siblingMembershipMode?: string | null;
    siblingRoleId?: string | null;
    parliamentSourceGroupIds?: readonly string[] | null;
  }
) {
  const sourceGroupIds = [...new Set((args.parliamentSourceGroupIds ?? []).filter(Boolean))];

  if (args.groupType !== 'sibling') {
    if (
      args.connectedGroupId != null ||
      args.siblingMembershipMode != null ||
      args.siblingRoleId != null ||
      sourceGroupIds.length > 0
    ) {
      throw new Error(
        'Only sibling groups can define connected groups or sibling membership rules.'
      );
    }
    return;
  }

  if (!args.connectedGroupId) {
    throw new Error('Sibling groups require a connected group.');
  }

  if (!args.siblingMembershipMode) {
    throw new Error('Sibling groups require a sibling membership mode.');
  }

  if (args.connectedGroupId === args.groupId) {
    throw new Error('A sibling group cannot connect to itself.');
  }

  const connectedGroup = await tx.run(zql.group.where('id', args.connectedGroupId).one());
  if (!connectedGroup) {
    throw new Error('Connected group not found.');
  }

  if (args.siblingMembershipMode === 'elected') {
    if (!args.siblingRoleId) {
      throw new Error('Elected sibling groups require a connected role.');
    }

    const role = await tx.run(zql.role.where('id', args.siblingRoleId).one());
    if (!role || role.group_id !== args.connectedGroupId || role.scope !== 'group') {
      throw new Error('Connected role must be a group role of the connected group.');
    }

    if (role.assignee_kind === 'guest') {
      throw new Error('Guest roles cannot drive elected sibling memberships.');
    }
  } else if (args.siblingRoleId) {
    throw new Error('Only elected sibling groups may define a connected role.');
  }

  if (args.siblingMembershipMode === 'parliament') {
    if (sourceGroupIds.length === 0) {
      throw new Error('Parliament sibling groups require at least one source group.');
    }

    if (sourceGroupIds.includes(args.groupId)) {
      throw new Error('A parliament group cannot reference itself as a source.');
    }

    const existingLinks = await tx.run(zql.group_sibling_source);
    const edges = new Map<string, string[]>();

    for (const link of existingLinks) {
      if (link.group_id === args.groupId) {
        continue;
      }

      const nextEdges = edges.get(link.group_id) ?? [];
      nextEdges.push(link.source_group_id);
      edges.set(link.group_id, nextEdges);
    }

    edges.set(args.groupId, sourceGroupIds);

    const queue = [...sourceGroupIds];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentGroupId = queue.shift();
      if (!currentGroupId || visited.has(currentGroupId)) {
        continue;
      }

      if (currentGroupId === args.groupId) {
        throw new Error('Parliament source groups may not form cycles.');
      }

      visited.add(currentGroupId);
      const nextSourceGroupIds = edges.get(currentGroupId) ?? [];
      queue.push(...nextSourceGroupIds);
    }
  } else if (sourceGroupIds.length > 0) {
    throw new Error('Only parliament sibling groups may define source groups.');
  }
}

export async function syncSiblingSourceGroups(
  tx: ZeroTransactionLike,
  groupId: string,
  sourceGroupIds: readonly string[]
) {
  const desiredIds = [...new Set(sourceGroupIds)];
  const existingLinks = await tx.run(zql.group_sibling_source.where('group_id', groupId));
  const desiredIdSet = new Set(desiredIds);
  const existingIds = new Set(existingLinks.map(link => link.source_group_id));

  for (const existingLink of existingLinks) {
    if (!desiredIdSet.has(existingLink.source_group_id)) {
      await tx.mutate.group_sibling_source.delete({ id: existingLink.id });
    }
  }

  for (const desiredId of desiredIds) {
    if (!existingIds.has(desiredId)) {
      await tx.mutate.group_sibling_source.insert({
        id: crypto.randomUUID(),
        group_id: groupId,
        source_group_id: desiredId,
        created_at: Date.now(),
      });
    }
  }
}
