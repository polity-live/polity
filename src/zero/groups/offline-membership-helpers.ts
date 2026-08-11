import { resolveHierarchicalAncestors } from '@/features/groups/logic/hierarchy';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { isActiveGroupStatus } from '../server-helpers';
import { zql } from '../schema';
import {
  buildGroupsById,
  filterHierarchyRelationships,
  loadActiveHierarchyRelationships,
} from './membership-helpers';
import {
  HIERARCHY_DERIVED_MEMBERSHIP_SOURCE,
  SIBLING_ALL_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from './membership-source-constants';
import { normalizeMembershipRule } from '../network/membershipRules';

type ZeroTransactionLike = Pick<ZeroTransaction, 'run' | 'mutate'>;

type OfflineMembershipSource =
  | 'direct'
  | typeof HIERARCHY_DERIVED_MEMBERSHIP_SOURCE
  | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
  | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
  | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;

const SIBLING_AUTOMATIC_OFFLINE_SOURCES = new Set<string>([
  SIBLING_ALL_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
]);

function normalizeSourceGroupId(sourceGroupId: string | null | undefined) {
  return sourceGroupId ?? null;
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

interface SelectedOfflineSourceGroupMembershipContext {
  connectedGroupId: string;
  selectedSourceGroupIds: string[];
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
    source:
      | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
      | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
      | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
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

async function getDesiredOfflineGroupConnectionMembershipSources(
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
      source:
        | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
        | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
        | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
      sourceGroupId: string | null;
    }
  >();
  const selectedSourceGroupContexts: SelectedOfflineSourceGroupMembershipContext[] = [];

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
        const connectedMemberships = await loadActiveOfflineMembershipsForGroup(
          tx,
          connectedGroupId
        );

        for (const membership of connectedMemberships) {
          if (!desiredMembershipSources.has(membership.group_offline_member_id)) {
            desiredMembershipSources.set(membership.group_offline_member_id, {
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

        const memberships = await getActiveOfflineMembersForGroupRole(
          tx,
          connectedGroupId,
          directionalContext.membershipRule.required_source_role_id
        );
        for (const membership of memberships) {
          if (!desiredMembershipSources.has(membership.group_offline_member_id)) {
            desiredMembershipSources.set(membership.group_offline_member_id, {
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

  await addSelectedOfflineSourceGroupMembershipSources(
    tx,
    selectedSourceGroupContexts,
    desiredMembershipSources
  );

  return desiredMembershipSources;
}

async function addSelectedOfflineSourceGroupMembershipSources(
  tx: ZeroTransactionLike,
  contexts: readonly SelectedOfflineSourceGroupMembershipContext[],
  desiredMembershipSources: Map<
    string,
    {
      source:
        | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
        | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
        | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
      sourceGroupId: string | null;
    }
  >
) {
  if (contexts.length === 0) {
    return;
  }

  const sourceGroupsByOfflineMemberId = new Map<string, Set<string>>();

  for (const context of contexts) {
    const connectedMemberships = await loadActiveOfflineMembershipsForGroup(
      tx,
      context.connectedGroupId
    );
    const connectedOfflineMemberIds = new Set(
      connectedMemberships.map(membership => membership.group_offline_member_id)
    );

    for (const sourceGroupId of context.selectedSourceGroupIds) {
      const sourceMemberships = await loadActiveOfflineMembershipsForGroup(tx, sourceGroupId);

      for (const membership of sourceMemberships) {
        if (!connectedOfflineMemberIds.has(membership.group_offline_member_id)) {
          continue;
        }

        const sourceGroupIds =
          sourceGroupsByOfflineMemberId.get(membership.group_offline_member_id) ??
          new Set<string>();
        sourceGroupIds.add(sourceGroupId);
        sourceGroupsByOfflineMemberId.set(membership.group_offline_member_id, sourceGroupIds);
      }
    }
  }

  for (const [groupOfflineMemberId, sourceGroupIds] of sourceGroupsByOfflineMemberId.entries()) {
    if (sourceGroupIds.size !== 1 || desiredMembershipSources.has(groupOfflineMemberId)) {
      continue;
    }

    desiredMembershipSources.set(groupOfflineMemberId, {
      source: SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
      sourceGroupId: [...sourceGroupIds][0],
    });
  }
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
  const existingMemberships = await tx.run(zql.group_offline_membership.where('group_id', groupId));
  const desiredMembershipSources = await getDesiredOfflineGroupConnectionMembershipSources(
    tx,
    groupId
  );

  for (const membership of existingMemberships) {
    if (!isAutomaticOfflineMembershipSource(membership.source)) {
      continue;
    }

    const expectedMembershipSource =
      desiredMembershipSources.get(membership.group_offline_member_id) ?? null;
    const shouldExist = expectedMembershipSource != null;
    const canKeep =
      shouldExist &&
      membership.source === expectedMembershipSource.source &&
      normalizeSourceGroupId(membership.source_group_id) ===
        expectedMembershipSource.sourceGroupId &&
      isActiveGroupStatus(membership.status);

    if (!canKeep) {
      await tx.mutate.group_offline_membership.delete({ id: membership.id });
    }
  }

  for (const [groupOfflineMemberId, membershipSource] of desiredMembershipSources.entries()) {
    await upsertAutomaticSiblingOfflineMembership(tx, {
      groupId,
      groupOfflineMemberId,
      source: membershipSource.source,
      sourceGroupId: membershipSource.sourceGroupId,
    });
  }

  return new Set<string>([groupId]);
}

export async function recomputeOfflineSiblingMembershipsForGroup(
  tx: ZeroTransactionLike,
  groupId: string
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

    const siblingGroupIds = new Set<string>();
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
          siblingGroupIds.add(directionalContext.recipientGroupId);
        }
      }
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
  const hierarchyRelationships = filterHierarchyRelationships(
    await loadActiveHierarchyRelationships(tx, groupsById),
    groupsById
  );
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

export const offlineMembershipHelperInternals = {
  normalizeSourceGroupId,
  getDirectionalMembershipContexts,
  isEffectiveOfflineMembership,
  loadOfflineMembershipsWithMembersForGroup,
  loadOfflineMembershipsWithMembersByGroupIds,
  loadActiveOfflineMembershipsForGroup,
  getActiveOfflineMembersForGroupRole,
  isActiveGroupConnectionStatus,
  getNetworkMembershipSourceForMode,
  getOfflineMembershipKey,
  upsertOfflineMembership,
  upsertHierarchyDerivedOfflineMembership,
  upsertAutomaticSiblingOfflineMembership,
  getDesiredOfflineGroupConnectionMembershipSources,
  addSelectedOfflineSourceGroupMembershipSources,
};
