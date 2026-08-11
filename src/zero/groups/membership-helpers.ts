import { zql } from '../schema';
import type { ZeroTransaction } from '@/server/zero-mutate';
import {
  isActiveGroupStatus,
  recomputeGroupCounters,
  recomputeUserCounters,
  syncUserWithGroupConversation,
} from '../server-helpers';
import {
  HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
  SIBLING_ALL_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from './membership-source-constants';
import { deriveGroupRelationships, getDefaultDerivedGroupNetworkMeta } from '../network/derived';
import { normalizeMembershipRule } from '../network/membershipRules';

type ZeroTransactionLike = Pick<ZeroTransaction, 'run' | 'mutate'>;
type ServerHelperTx = Parameters<typeof recomputeGroupCounters>[0];

function asServerHelperTx(tx: ZeroTransactionLike) {
  return tx as ServerHelperTx;
}

const SIBLING_AUTOMATIC_SOURCES = new Set([
  SIBLING_ALL_MEMBERSHIP_SOURCE,
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

function getDirectionalMembershipContexts(
  connection: { group_a_id: string; group_b_id: string },
  membershipRule:
    | {
        member_source_group_id?: string | null;
        member_target_group_id?: string | null;
        membership_mode?: string | null;
        required_source_role_id?: string | null;
        eligible_origin_group_ids?: string[] | null;
      }
    | null
    | undefined
) {
  const normalized = normalizeMembershipRule(membershipRule);
  if (!normalized) {
    return [];
  }

  return [
    {
      recipientGroupId: normalized.member_target_group_id,
      connectedGroupId: normalized.member_source_group_id,
      membershipRule: normalized,
    },
  ];
}

export async function loadGroupsWithDerivedNetworkMeta(
  tx: ZeroTransactionLike,
  groupIds?: readonly string[]
) {
  const normalizedGroupIds = [...new Set((groupIds ?? []).filter(Boolean))];
  const groups =
    normalizedGroupIds.length > 0
      ? await tx.run(zql.group.where('id', 'IN', normalizedGroupIds))
      : await tx.run(zql.group);
  const defaults = getDefaultDerivedGroupNetworkMeta();

  return groups.map(group => ({
    ...defaults,
    ...group,
    group_type: group.group_type ?? defaults.group_type,
    has_hierarchy_children: group.has_hierarchy_children ?? defaults.has_hierarchy_children,
    has_sibling_connections: group.has_sibling_connections ?? defaults.has_sibling_connections,
    connected_group_id: group.connected_group_id ?? defaults.connected_group_id,
    primary_sibling_membership_mode:
      group.primary_sibling_membership_mode ?? defaults.primary_sibling_membership_mode,
    sibling_membership_mode: group.sibling_membership_mode ?? defaults.sibling_membership_mode,
    sibling_role_id: group.sibling_role_id ?? defaults.sibling_role_id,
  }));
}

export async function loadGroupWithDerivedNetworkMeta(tx: ZeroTransactionLike, groupId: string) {
  const groups = await loadGroupsWithDerivedNetworkMeta(tx, [groupId]);
  return groups[0] ?? null;
}

export async function buildGroupsById(
  tx: ZeroTransactionLike,
  groupIds?: readonly string[]
): Promise<Map<string, { id: string; group_type?: string | null }>> {
  const groups = await loadGroupsWithDerivedNetworkMeta(tx, groupIds);

  return new Map(groups.map(group => [group.id, group]));
}

export async function loadActiveHierarchyRelationships(
  tx: ZeroTransactionLike,
  groupsById: ReadonlyMap<string, { group_type?: string | null | undefined }>
) {
  const [connections, grants, rules] = await Promise.all([
    tx.run(zql.group_connection),
    tx.run(zql.group_right_grant),
    tx.run(zql.group_membership_rule),
  ]);

  return filterHierarchyRelationships(
    deriveGroupRelationships({
      connections,
      grants,
      rules,
      includeInactive: false,
    }).filter(relationship => relationship.relationship_type !== 'sibling'),
    groupsById
  );
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

function isActiveGroupConnectionStatus(status: string | null | undefined) {
  return status === 'active';
}

function getNetworkMembershipSourceForMode(mode: string | null | undefined) {
  switch (mode) {
    case 'all_members':
      return SIBLING_ALL_MEMBERSHIP_SOURCE;
    case 'role_members':
      return SIBLING_ELECTED_MEMBERSHIP_SOURCE;
    case 'selected_source_groups':
      return SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
    default:
      return null;
  }
}

interface SelectedSourceGroupMembershipContext {
  connectedGroupId: string;
  selectedSourceGroupIds: string[];
}

async function addSelectedSourceGroupMembershipSources(
  tx: ZeroTransactionLike,
  contexts: readonly SelectedSourceGroupMembershipContext[],
  desiredMembershipSources: Map<
    string,
    {
      source: string;
      sourceGroupId: string | null;
    }
  >
) {
  if (contexts.length === 0) {
    return;
  }

  const sourceGroupsByUserId = new Map<string, Set<string>>();

  for (const context of contexts) {
    const connectedActiveUserIds = await getActiveUserIdsForGroup(tx, context.connectedGroupId);

    for (const sourceGroupId of context.selectedSourceGroupIds) {
      const sourceMemberIds = await getActiveUserIdsForGroup(tx, sourceGroupId);

      for (const userId of sourceMemberIds) {
        if (!connectedActiveUserIds.has(userId)) {
          continue;
        }

        const userSourceGroupIds = sourceGroupsByUserId.get(userId) ?? new Set<string>();
        userSourceGroupIds.add(sourceGroupId);
        sourceGroupsByUserId.set(userId, userSourceGroupIds);
      }
    }
  }

  for (const [userId, userSourceGroupIds] of sourceGroupsByUserId.entries()) {
    if (userSourceGroupIds.size !== 1 || desiredMembershipSources.has(userId)) {
      continue;
    }

    desiredMembershipSources.set(userId, {
      source: SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
      sourceGroupId: [...userSourceGroupIds][0],
    });
  }
}

async function getDesiredGroupConnectionMembershipSources(
  tx: ZeroTransactionLike,
  groupId: string
) {
  const [connections, rules, origins] = await Promise.all([
    tx.run(
      zql.group_connection.where(({ cmp, or }) =>
        or(cmp('group_a_id', '=', groupId), cmp('group_b_id', '=', groupId))
      )
    ),
    tx.run(zql.group_membership_rule),
    tx.run(zql.group_membership_rule_origin),
  ]);

  const rulesByConnectionId = new Map<
    string,
    (typeof rules)[number] & {
      eligible_origin_group_ids: string[];
    }
  >();
  for (const rule of rules) {
    rulesByConnectionId.set(rule.connection_id, {
      ...rule,
      eligible_origin_group_ids: origins
        .filter(origin => origin.membership_rule_id === rule.id)
        .map(origin => origin.eligible_origin_group_id),
    });
  }

  const desiredMembershipSources = new Map<
    string,
    {
      source: string;
      sourceGroupId: string | null;
    }
  >();
  const selectedSourceGroupContexts: SelectedSourceGroupMembershipContext[] = [];

  const sortedConnections = [...connections].sort(
    (left, right) => left.created_at - right.created_at
  );

  for (const connection of sortedConnections) {
    const membershipRule = rulesByConnectionId.get(connection.id);
    const directionalContexts = getDirectionalMembershipContexts(connection, membershipRule).filter(
      context => context.recipientGroupId === groupId
    );
    if (directionalContexts.length === 0) {
      continue;
    }

    if (!isActiveGroupConnectionStatus(connection.status)) {
      continue;
    }

    for (const directionalContext of directionalContexts) {
      const membershipSource = getNetworkMembershipSourceForMode(
        directionalContext.membershipRule.membership_mode
      );
      if (!membershipSource) {
        continue;
      }

      const connectedGroupId = directionalContext.connectedGroupId;

      if (directionalContext.membershipRule.membership_mode === 'all_members') {
        const connectedActiveUserIds = await getActiveUserIdsForGroup(tx, connectedGroupId);

        for (const userId of connectedActiveUserIds) {
          if (!desiredMembershipSources.has(userId)) {
            desiredMembershipSources.set(userId, {
              source: membershipSource,
              sourceGroupId: connectedGroupId,
            });
          }
        }
        continue;
      }

      if (directionalContext.membershipRule.membership_mode === 'role_members') {
        if (!directionalContext.membershipRule.required_source_role_id) {
          continue;
        }

        const userIds = await getActiveUsersForGroupRole(
          tx,
          connectedGroupId,
          directionalContext.membershipRule.required_source_role_id
        );
        for (const userId of userIds) {
          if (!desiredMembershipSources.has(userId)) {
            desiredMembershipSources.set(userId, {
              source: membershipSource,
              sourceGroupId: connectedGroupId,
            });
          }
        }
        continue;
      }

      const selectedSourceGroupIds = [
        ...new Set(directionalContext.membershipRule.eligible_origin_group_ids),
      ].filter(Boolean);
      if (selectedSourceGroupIds.length === 0) {
        continue;
      }

      selectedSourceGroupContexts.push({
        connectedGroupId,
        selectedSourceGroupIds,
      });
    }
  }

  await addSelectedSourceGroupMembershipSources(
    tx,
    selectedSourceGroupContexts,
    desiredMembershipSources
  );

  return desiredMembershipSources;
}

async function upsertAutomaticSiblingMembership(
  tx: ZeroTransactionLike,
  args: {
    groupId: string;
    userId: string;
    source:
      | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
      | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
      | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
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

export async function recomputeSiblingGroupMemberships(
  tx: ZeroTransactionLike,
  groupId: string,
  assignedById?: string | null
) {
  const existingMemberships = await tx.run(zql.group_membership.where('group_id', groupId));
  const affectedUserIds = new Set(existingMemberships.map(membership => membership.user_id));
  const desiredMembershipSources = await getDesiredGroupConnectionMembershipSources(tx, groupId);

  for (const membership of existingMemberships) {
    if (!isSiblingAutomaticMembershipSource(membership.source)) {
      continue;
    }

    const expectedMembershipSource = desiredMembershipSources.get(membership.user_id) ?? null;
    const shouldExist = expectedMembershipSource != null;
    const canKeep =
      shouldExist &&
      membership.source === expectedMembershipSource.source &&
      membership.status === 'active' &&
      membership.source_group_id === expectedMembershipSource.sourceGroupId;

    if (!canKeep) {
      await tx.mutate.group_membership.delete({ id: membership.id });
    }
  }

  for (const [userId, membershipSource] of desiredMembershipSources.entries()) {
    affectedUserIds.add(userId);
    await upsertAutomaticSiblingMembership(tx, {
      groupId,
      userId,
      source: membershipSource.source as
        | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
        | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
        | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
      sourceGroupId: membershipSource.sourceGroupId,
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
  const [connections, rules, origins] = await Promise.all([
    tx.run(zql.group_connection),
    tx.run(zql.group_membership_rule),
    tx.run(zql.group_membership_rule_origin),
  ]);
  const rulesByConnectionId = new Map<
    string,
    (typeof rules)[number] & {
      eligible_origin_group_ids: string[];
    }
  >();
  for (const rule of rules) {
    rulesByConnectionId.set(rule.connection_id, {
      ...rule,
      eligible_origin_group_ids: origins
        .filter(origin => origin.membership_rule_id === rule.id)
        .map(origin => origin.eligible_origin_group_id),
    });
  }

  const queue = [groupId];
  const visitedGroups = new Set<string>();
  const recomputedSiblingGroups = new Set<string>();

  while (queue.length > 0) {
    const currentGroupId = queue.shift();
    if (!currentGroupId || visitedGroups.has(currentGroupId)) {
      continue;
    }

    visitedGroups.add(currentGroupId);

    const recipientGroupIds = new Set<string>();

    for (const connection of connections) {
      const membershipRule = rulesByConnectionId.get(connection.id);
      for (const directionalContext of getDirectionalMembershipContexts(
        connection,
        membershipRule
      )) {
        if (
          directionalContext.recipientGroupId === currentGroupId ||
          directionalContext.connectedGroupId === currentGroupId ||
          directionalContext.membershipRule.eligible_origin_group_ids.includes(currentGroupId)
        ) {
          recipientGroupIds.add(directionalContext.recipientGroupId);
        }
      }
    }

    for (const recipientGroupId of recipientGroupIds) {
      if (!recomputedSiblingGroups.has(recipientGroupId)) {
        await recomputeSiblingGroupMemberships(tx, recipientGroupId, assignedById);
        recomputedSiblingGroups.add(recipientGroupId);
      }
      queue.push(recipientGroupId);
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
  void tx;
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
  } else if (sourceGroupIds.length > 0) {
    throw new Error('Only parliament sibling groups may define source groups.');
  }
}

export async function syncSiblingSourceGroups(
  tx: ZeroTransactionLike,
  groupId: string,
  sourceGroupIds: readonly string[]
) {
  void tx;
  void groupId;
  void sourceGroupIds;
}

export const groupMembershipHelperInternals = {
  asServerHelperTx,
  getDirectionalMembershipContexts,
  addGroupMembershipRoleLink,
  getMemberRoleId,
  ensureMemberRoleLink,
  getActiveUserIdsForGroup,
  getActiveUsersForGroupRole,
  isActiveGroupConnectionStatus,
  getNetworkMembershipSourceForMode,
  addSelectedSourceGroupMembershipSources,
  getDesiredGroupConnectionMembershipSources,
  upsertAutomaticSiblingMembership,
};
