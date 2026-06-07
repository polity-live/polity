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
  SIBLING_ALL_MEMBERSHIP_SOURCE,
  SIBLING_ELECTED_MEMBERSHIP_SOURCE,
  SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE,
} from './membership-source-constants';
import {
  buildDerivedGroupNetworkMetaMap,
  explodeNetworkLinksToRelationships,
  getDefaultDerivedGroupNetworkMeta,
} from '../network/derived';
import { getMembershipRuleConfig, hasActiveMembershipRules } from '../network/membershipRules';

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
  link: { source_group_id: string; target_group_id: string },
  membershipRule:
    | {
        membership_direction?: string | null;
        membership_mode?: string | null;
        role_id?: string | null;
        source_group_ids?: string[] | null;
      }
    | null
    | undefined
) {
  if (!hasActiveMembershipRules(membershipRule)) {
    return [];
  }

  const forward = getMembershipRuleConfig(membershipRule, 'forward');
  const backward = getMembershipRuleConfig(membershipRule, 'backward');

  return [
    ...(forward.membership_mode !== 'none'
      ? [
          {
            recipientGroupId: link.target_group_id,
            connectedGroupId: link.source_group_id,
            membershipRule: forward,
          },
        ]
      : []),
    ...(backward.membership_mode !== 'none'
      ? [
          {
            recipientGroupId: link.source_group_id,
            connectedGroupId: link.target_group_id,
            membershipRule: backward,
          },
        ]
      : []),
  ];
}

async function loadNetworkLinkContextForGroups(
  tx: ZeroTransactionLike,
  groupIds?: readonly string[]
) {
  const normalizedGroupIds = [...new Set((groupIds ?? []).filter(Boolean))];
  const groups =
    normalizedGroupIds.length > 0
      ? await tx.run(zql.group.where('id', 'IN', normalizedGroupIds))
      : await tx.run(zql.group);
  const links =
    normalizedGroupIds.length > 0
      ? await tx.run(
          zql.network_link.where(({ cmp, or }) =>
            or(
              cmp('source_group_id', 'IN', normalizedGroupIds),
              cmp('target_group_id', 'IN', normalizedGroupIds)
            )
          )
        )
      : await tx.run(zql.network_link);
  const linkIds = links.map(link => link.id);
  const [rights, rules] = await Promise.all([
    linkIds.length > 0
      ? tx.run(zql.network_link_right.where('network_link_id', 'IN', linkIds))
      : [],
    linkIds.length > 0
      ? tx.run(zql.network_link_membership_rule.where('network_link_id', 'IN', linkIds))
      : [],
  ]);

  return { groups, links, rights, rules };
}

export async function loadGroupsWithDerivedNetworkMeta(
  tx: ZeroTransactionLike,
  groupIds?: readonly string[]
) {
  const { groups, links, rights, rules } = await loadNetworkLinkContextForGroups(tx, groupIds);
  const derivedMetaByGroupId = buildDerivedGroupNetworkMetaMap({
    groupIds: groups.map(group => group.id),
    links,
    rights,
    rules,
  });

  return groups.map(group => ({
    ...group,
    ...(derivedMetaByGroupId.get(group.id) ?? getDefaultDerivedGroupNetworkMeta()),
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
  const [links, rights, rules] = await Promise.all([
    tx.run(zql.network_link),
    tx.run(zql.network_link_right),
    tx.run(zql.network_link_membership_rule),
  ]);

  return filterHierarchyRelationships(
    explodeNetworkLinksToRelationships({
      links,
      rights,
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

function isActiveNetworkLinkStatus(status: string | null | undefined) {
  return status == null || status === 'active' || status === 'accepted';
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

async function getDesiredNetworkLinkMembershipSources(tx: ZeroTransactionLike, groupId: string) {
  const [links, rights, rules] = await Promise.all([
    tx.run(
      zql.network_link.where(({ cmp, or }) =>
        or(cmp('source_group_id', '=', groupId), cmp('target_group_id', '=', groupId))
      )
    ),
    tx.run(zql.network_link_right),
    tx.run(zql.network_link_membership_rule),
  ]);

  const rightsByLinkId = new Map<string, (typeof rights)[number][]>();
  for (const right of rights) {
    const linkRights = rightsByLinkId.get(right.network_link_id) ?? [];
    linkRights.push(right);
    rightsByLinkId.set(right.network_link_id, linkRights);
  }

  const rulesByLinkId = new Map<string, (typeof rules)[number]>();
  for (const rule of rules) {
    rulesByLinkId.set(rule.network_link_id, rule);
  }

  const desiredMembershipSources = new Map<
    string,
    {
      source: string;
      sourceGroupId: string | null;
    }
  >();

  const sortedLinks = [...links].sort((left, right) => left.created_at - right.created_at);

  for (const link of sortedLinks) {
    const membershipRule = rulesByLinkId.get(link.id);
    const directionalContexts = getDirectionalMembershipContexts(link, membershipRule).filter(
      context => context.recipientGroupId === groupId
    );
    if (directionalContexts.length === 0) {
      continue;
    }

    const linkRights = rightsByLinkId.get(link.id) ?? [];
    const hasActiveRights =
      isActiveNetworkLinkStatus(link.status) ||
      linkRights.some(right => isActiveNetworkLinkStatus(right.status));
    if (!hasActiveRights) {
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
      const connectedActiveUserIds = await getActiveUserIdsForGroup(tx, connectedGroupId);

      if (directionalContext.membershipRule.membership_mode === 'all_members') {
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
        if (!directionalContext.membershipRule.role_id) {
          continue;
        }

        const userIds = await getActiveUsersForGroupRole(
          tx,
          connectedGroupId,
          directionalContext.membershipRule.role_id
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
        ...new Set(directionalContext.membershipRule.source_group_ids ?? []),
      ].filter(Boolean);
      if (selectedSourceGroupIds.length === 0) {
        continue;
      }

      const sourceGroupsByUserId = new Map<string, Set<string>>();
      for (const sourceGroupId of selectedSourceGroupIds) {
        const sourceMemberIds = await getActiveUserIdsForGroup(tx, sourceGroupId);
        for (const userId of sourceMemberIds) {
          const userSourceGroupIds = sourceGroupsByUserId.get(userId) ?? new Set<string>();
          userSourceGroupIds.add(sourceGroupId);
          sourceGroupsByUserId.set(userId, userSourceGroupIds);
        }
      }

      for (const [userId, userSourceGroupIds] of sourceGroupsByUserId.entries()) {
        if (!connectedActiveUserIds.has(userId) || userSourceGroupIds.size !== 1) {
          continue;
        }

        if (!desiredMembershipSources.has(userId)) {
          desiredMembershipSources.set(userId, {
            source: membershipSource,
            sourceGroupId: [...userSourceGroupIds][0] ?? null,
          });
        }
      }
    }
  }

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

export async function recomputeSiblingGroupMemberships(
  tx: ZeroTransactionLike,
  groupId: string,
  assignedById?: string | null
) {
  const existingMemberships = await tx.run(zql.group_membership.where('group_id', groupId));
  const affectedUserIds = new Set(existingMemberships.map(membership => membership.user_id));
  const desiredMembershipSources = await getDesiredNetworkLinkMembershipSources(tx, groupId);

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
  const [links, rules] = await Promise.all([
    tx.run(zql.network_link),
    tx.run(zql.network_link_membership_rule),
  ]);
  const rulesByLinkId = new Map<string, (typeof rules)[number]>();
  for (const rule of rules) {
    rulesByLinkId.set(rule.network_link_id, rule);
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

    for (const link of links) {
      const membershipRule = rulesByLinkId.get(link.id);
      for (const directionalContext of getDirectionalMembershipContexts(link, membershipRule)) {
        if (
          directionalContext.recipientGroupId === currentGroupId ||
          directionalContext.connectedGroupId === currentGroupId ||
          (directionalContext.membershipRule.source_group_ids ?? []).includes(currentGroupId)
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

export async function reconcileHierarchyForBaseGroup(
  tx: ZeroTransactionLike,
  baseGroupId: string,
  assignedById?: string | null
) {
  const groupsById = await buildGroupsById(tx);
  const hierarchyRelationships = await loadActiveHierarchyRelationships(tx, groupsById);
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
