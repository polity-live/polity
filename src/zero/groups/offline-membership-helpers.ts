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
import { getMembershipRuleConfig, hasActiveMembershipRules } from '../network/membershipRules';

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
  link: { source_group_id: string; target_group_id: string },
  membershipRule:
    | {
        membership_mode?: string | null;
        role_id?: string | null;
        source_group_ids?: string[] | null;
        forward_membership_mode?: string | null;
        forward_role_id?: string | null;
        forward_source_group_ids?: string[] | null;
        backward_membership_mode?: string | null;
        backward_role_id?: string | null;
        backward_source_group_ids?: string[] | null;
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

async function getDesiredOfflineNetworkLinkMembershipSources(
  tx: ZeroTransactionLike,
  groupId: string
) {
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
      source:
        | typeof SIBLING_ALL_MEMBERSHIP_SOURCE
        | typeof SIBLING_ELECTED_MEMBERSHIP_SOURCE
        | typeof SIBLING_PARLIAMENT_MEMBERSHIP_SOURCE;
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
      const connectedMemberships = await loadActiveOfflineMembershipsForGroup(tx, connectedGroupId);
      const connectedOfflineMemberIds = new Set(
        connectedMemberships.map(membership => membership.group_offline_member_id)
      );

      if (directionalContext.membershipRule.membership_mode === 'all_members') {
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
        if (!directionalContext.membershipRule.role_id) {
          continue;
        }

        const memberships = await getActiveOfflineMembersForGroupRole(
          tx,
          connectedGroupId,
          directionalContext.membershipRule.role_id
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
        ...new Set(directionalContext.membershipRule.source_group_ids ?? []),
      ].filter(Boolean);
      if (selectedSourceGroupIds.length === 0) {
        continue;
      }

      const sourceGroupsByOfflineMemberId = new Map<string, Set<string>>();
      for (const sourceGroupId of selectedSourceGroupIds) {
        const sourceMemberships = await loadActiveOfflineMembershipsForGroup(tx, sourceGroupId);
        for (const membership of sourceMemberships) {
          const sourceGroupIds =
            sourceGroupsByOfflineMemberId.get(membership.group_offline_member_id) ??
            new Set<string>();
          sourceGroupIds.add(sourceGroupId);
          sourceGroupsByOfflineMemberId.set(membership.group_offline_member_id, sourceGroupIds);
        }
      }

      for (const [
        groupOfflineMemberId,
        sourceGroupIds,
      ] of sourceGroupsByOfflineMemberId.entries()) {
        if (!connectedOfflineMemberIds.has(groupOfflineMemberId) || sourceGroupIds.size !== 1) {
          continue;
        }

        if (!desiredMembershipSources.has(groupOfflineMemberId)) {
          desiredMembershipSources.set(groupOfflineMemberId, {
            source: membershipSource,
            sourceGroupId: [...sourceGroupIds][0] ?? null,
          });
        }
      }
    }
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
  const existingMemberships = await tx.run(zql.group_offline_membership.where('group_id', groupId));
  const desiredMembershipSources = await getDesiredOfflineNetworkLinkMembershipSources(tx, groupId);

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

    const siblingGroupIds = new Set<string>();
    for (const link of links) {
      const membershipRule = rulesByLinkId.get(link.id);
      for (const directionalContext of getDirectionalMembershipContexts(link, membershipRule)) {
        if (
          directionalContext.recipientGroupId === currentGroupId ||
          directionalContext.connectedGroupId === currentGroupId ||
          (directionalContext.membershipRule.source_group_ids ?? []).includes(currentGroupId)
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
