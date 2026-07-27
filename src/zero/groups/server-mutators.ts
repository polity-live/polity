import { defineMutator } from '@rocicorp/zero';
import { z } from 'zod';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { eventServerMutators } from '../events/server-mutators';
import { networkServerMutators } from '../network/server-mutators';
import {
  amendmentTitle,
  blogTitle,
  eventTitle,
  groupName,
  userName,
  roleName,
  isActiveGroupStatus,
  ensureGroupConversation,
  recomputeGroupCounters,
  recomputeUserCounters,
  syncUserWithGroupConversation,
} from '../server-helpers';
import { DEFAULT_GROUP_ROLES } from '../rbac/constants';
import { reconcileGeneralAssemblyParticipantsForGroups } from '../events/assembly-reconcile';
import { reconcileDelegateAllocationsForGroups } from '../events/delegate-allocation-reconcile';
import { reconcileGroupGraph } from '../network/group-graph-reconcile';
import { syncEntityHashtagsForCreate } from '../common/server-hashtags';
import {
  groupCreateSchema,
  groupFullCreateMutatorSchema,
  groupMembershipCreateSchema,
  groupMembershipDeleteSchema,
  groupMembershipUpdateSchema,
  groupOfflineMemberCreateSchema,
  groupOfflineMemberUpdateSchema,
  groupOfflineMemberDeleteSchema,
  groupOfflineMemberBulkImportSchema,
  groupOfflineMembershipRoleAssignSchema,
  groupOfflineMembershipRoleUnassignSchema,
  groupOfflineMembershipRolesSyncSchema,
  groupMembershipRoleAssignSchema,
  groupMembershipRoleUnassignSchema,
  groupMembershipRolesSyncSchema,
  groupUpdateSchema,
  groupGuestAccessCreateSchema,
  groupGuestAccessAcceptSchema,
  groupGuestAccessDeleteSchema,
  groupGuestRoleAssignSchema,
  groupGuestRoleUnassignSchema,
  groupGuestRolesSyncSchema,
  roleCreateSchema,
  roleDeleteSchema,
  roleHolderHistoryCreateSchema,
  roleHolderHistoryUpdateSchema,
  actionRightCreateSchema,
  actionRightDeleteSchema,
} from './schema';
import {
  loadGroupWithDerivedNetworkMeta,
  recomputeSiblingMembershipsForGroup,
} from './membership-helpers';
import {
  reconcileOfflineHierarchyForBaseGroup,
  recomputeOfflineSiblingMembershipsForGroup,
} from './offline-membership-helpers';
import { assertNoBlockingGroupConflicts } from '@/server/group-conflict-validation';

async function addGroupMembershipRoleLink(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
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

async function syncGroupMembershipRoleLinks(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  args: {
    group_membership_id: string;
    role_ids: string[];
    assigned_by_id?: string | null;
  }
) {
  const desiredRoleIds = [...new Set(args.role_ids.filter(Boolean))];
  const existingLinks = await tx.run(
    zql.group_membership_role.where('group_membership_id', args.group_membership_id)
  );
  const desiredRoleIdSet = new Set(desiredRoleIds);
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.group_membership_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addGroupMembershipRoleLink(tx, {
        group_membership_id: args.group_membership_id,
        role_id: roleId,
        assigned_by_id: args.assigned_by_id,
      });
    }
  }
}

function sameStringSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every(value => bSet.has(value));
}

async function groupMembershipRoleIds(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  membershipId: string
) {
  const links = await tx.run(zql.group_membership_role.where('group_membership_id', membershipId));
  return links.map(link => link.role_id).filter(Boolean);
}

async function groupGuestRoleIds(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  guestAccessId: string
) {
  const links = await tx.run(zql.group_guest_role.where('group_guest_access_id', guestAccessId));
  return links.map(link => link.role_id).filter(Boolean);
}

async function roleSummary(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  roleIds: readonly string[],
  fallback = 'Default'
) {
  if (roleIds.length === 0) return fallback;
  const roles = await Promise.all(roleIds.map(roleId => roleName(tx, roleId)));
  return roles.map(role => role.name).join(', ');
}

async function notifyActiveMembershipRoleChange(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  actorUserId: string,
  membership: { id: string; group_id: string; user_id: string; status?: string | null },
  previousRoleIds: readonly string[]
) {
  if (!isActiveGroupStatus(membership.status)) return;

  const nextRoleIds = await groupMembershipRoleIds(tx, membership.id);
  if (sameStringSet(previousRoleIds, nextRoleIds)) return;

  const [gName, newRole] = await Promise.all([
    groupName(tx, membership.group_id),
    roleSummary(tx, nextRoleIds),
  ]);

  fireNotification('notifyMembershipRoleChanged', {
    senderId: actorUserId,
    recipientUserId: membership.user_id,
    groupId: membership.group_id,
    groupName: gName,
    newRole,
  });
}

async function notifyActiveGuestAccessRoleChange(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  actorUserId: string,
  guestAccess: { id: string; group_id: string; user_id: string; status?: string | null },
  previousRoleIds: readonly string[]
) {
  if (guestAccess.status !== 'active') return;

  const nextRoleIds = await groupGuestRoleIds(tx, guestAccess.id);
  if (sameStringSet(previousRoleIds, nextRoleIds)) return;

  const [gName, newRole] = await Promise.all([
    groupName(tx, guestAccess.group_id),
    roleSummary(tx, nextRoleIds, 'Guest'),
  ]);

  fireNotification('notifyGuestAccessRoleChanged', {
    senderId: actorUserId,
    recipientUserId: guestAccess.user_id,
    groupId: guestAccess.group_id,
    groupName: gName,
    newRole,
  });
}

async function loadBlogRoleNotificationContext(
  tx: Parameters<typeof mutators.groups.create.fn>[0]['tx'],
  blogId: string
) {
  const [title, blogRow, ownerRelation] = await Promise.all([
    blogTitle(tx, blogId),
    tx.run(zql.blog.where('id', blogId).one()),
    tx.run(zql.blog_blogger.where('blog_id', blogId).where('status', 'owner').one()),
  ]);

  return {
    blogTitle: title,
    groupId: blogRow?.group_id ?? undefined,
    ownerId: ownerRelation?.user_id ?? undefined,
  };
}

type GroupServerTx = Parameters<typeof mutators.groups.create.fn>[0]['tx'];

async function reconcileBaseGroupHierarchyMemberships(
  tx: GroupServerTx,
  baseGroupIds: readonly string[],
  assignedById?: string | null
) {
  const affectedMembershipGroupIds = new Set<string>();
  const graphResult = await reconcileGroupGraph(tx, {
    groupIds: baseGroupIds,
    assignedById,
    reason: 'group-membership-hierarchy',
  });

  for (const affectedGroupId of graphResult.affectedGroupIds) {
    affectedMembershipGroupIds.add(affectedGroupId);
  }

  for (const baseGroupId of [...new Set(baseGroupIds.filter(Boolean))]) {
    const { affectedGroupIds: offlineAffectedGroupIds } =
      await reconcileOfflineHierarchyForBaseGroup(tx, baseGroupId);

    for (const affectedGroupId of offlineAffectedGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }
  }

  return affectedMembershipGroupIds;
}

async function recomputeSiblingMembershipsForGroups(
  tx: GroupServerTx,
  groupIds: Iterable<string>,
  assignedById?: string | null
) {
  const affectedGroupIds = new Set<string>();

  for (const groupId of new Set([...groupIds].filter(Boolean))) {
    for (const affectedGroupId of await recomputeSiblingMembershipsForGroup(
      tx,
      groupId,
      assignedById
    )) {
      affectedGroupIds.add(affectedGroupId);
    }

    for (const affectedGroupId of await recomputeOfflineSiblingMembershipsForGroup(tx, groupId)) {
      affectedGroupIds.add(affectedGroupId);
    }
  }

  return affectedGroupIds;
}

async function expandAffectedGroupsWithSiblingMemberships(
  tx: GroupServerTx,
  groupIds: Iterable<string>,
  assignedById?: string | null
) {
  const affectedGroupIds = new Set<string>([...groupIds].filter(Boolean));
  const siblingAffectedGroupIds = await recomputeSiblingMembershipsForGroups(
    tx,
    affectedGroupIds,
    assignedById
  );

  for (const affectedGroupId of siblingAffectedGroupIds) {
    affectedGroupIds.add(affectedGroupId);
  }

  return affectedGroupIds;
}

async function recomputeGroupCountersForGroups(tx: GroupServerTx, groupIds: Iterable<string>) {
  for (const groupId of new Set([...groupIds].filter(Boolean))) {
    await recomputeGroupCounters(tx, groupId);
  }
}

async function reconcileMembershipDrivenEventsForGroups(
  tx: GroupServerTx,
  groupIds: Iterable<string>,
  assignedById?: string | null
) {
  const uniqueGroupIds = [...new Set([...groupIds].filter(Boolean))];
  if (uniqueGroupIds.length === 0) {
    return;
  }

  await reconcileGeneralAssemblyParticipantsForGroups(tx, uniqueGroupIds, assignedById);
  await reconcileDelegateAllocationsForGroups(tx, uniqueGroupIds);
  await reconcileGroupGraph(tx, {
    groupIds: uniqueGroupIds,
    assignedById,
    reason: 'group-membership-event-reconcile',
  });
}

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const groupServerMutators = {
  create: defineMutator(groupCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.create.fn({ tx, ctx, args });

    const now = Date.now();
    let adminRoleId: string | null = null;
    const totalRoles = DEFAULT_GROUP_ROLES.length;

    for (let index = 0; index < totalRoles; index++) {
      const roleDef = DEFAULT_GROUP_ROLES[index];
      const roleId = crypto.randomUUID();

      if (roleDef.name === 'Admin') {
        adminRoleId = roleId;
      }

      await tx.mutate.role.insert({
        id: roleId,
        name: roleDef.name,
        description: roleDef.description,
        scope: 'group',
        group_id: args.id,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        assignment_mode: 'assigned',
        visibility: roleDef.name === 'Member' ? 'private' : 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: roleDef.default_request_role,
        default_invite_role: roleDef.default_invite_role,
        assignee_kind: 'member',
        sort_order: totalRoles - 1 - index,
        created_at: now,
      });

      for (const permission of roleDef.permissions) {
        await tx.mutate.action_right.insert({
          id: crypto.randomUUID(),
          resource: permission.resource,
          action: permission.action,
          role_id: roleId,
          group_id: args.id,
          event_id: null,
          amendment_id: null,
          blog_id: null,
          created_at: now,
        });
      }
    }

    const shouldCreateCreatorMembership = true;

    if (shouldCreateCreatorMembership) {
      const creatorMembershipId = crypto.randomUUID();

      await tx.mutate.group_membership.insert({
        id: creatorMembershipId,
        group_id: args.id,
        user_id: ctx.userID,
        status: 'active',
        visibility: 'public',
        source: 'direct',
        source_group_id: null,
        created_at: now,
      });

      if (adminRoleId) {
        await syncGroupMembershipRoleLinks(tx, {
          group_membership_id: creatorMembershipId,
          role_ids: [adminRoleId],
          assigned_by_id: ctx.userID,
        });
      }
    }

    await ensureGroupConversation(tx, {
      groupId: args.id,
      name: args.name,
      requestedById: ctx.userID,
      createdAt: now,
    });
    if (shouldCreateCreatorMembership) {
      await syncUserWithGroupConversation(tx, {
        groupId: args.id,
        userId: ctx.userID,
      });
    }

    await recomputeGroupCounters(tx, args.id);
    await recomputeUserCounters(tx, ctx.userID);
    await reconcileGroupGraph(tx, {
      groupIds: [args.id],
      userIds: [ctx.userID],
      assignedById: ctx.userID,
      reason: 'group-create',
    });
  }),

  createFull: defineMutator(groupFullCreateMutatorSchema, async ({ tx, ctx, args }) => {
    await groupServerMutators.create.fn({ tx, ctx, args: args.group });

    await syncEntityHashtagsForCreate(tx, ctx, 'group', args.group.id, args.hashtags);

    for (const userId of args.official_invite_user_ids ?? []) {
      await groupServerMutators.inviteMember.fn({
        tx,
        ctx,
        args: {
          id: crypto.randomUUID(),
          user_id: userId,
          group_id: args.group.id,
          visibility: '',
          status: 'invited',
        },
      });
    }

    const guestInviteUserIds = args.guest_invite_user_ids ?? [];
    if (guestInviteUserIds.length > 0) {
      const guestRoleId = crypto.randomUUID();
      await groupServerMutators.createRole.fn({
        tx,
        ctx,
        args: {
          id: guestRoleId,
          name: 'Guest',
          description: '',
          scope: 'group',
          group_id: args.group.id,
          event_id: null,
          amendment_id: null,
          blog_id: null,
          visibility: 'private',
          assignee_kind: 'guest',
          assignment_mode: 'assigned',
          default_request_role: false,
          default_invite_role: false,
          is_recurring: false,
          sort_order: -1,
        },
      });

      for (const userId of guestInviteUserIds) {
        await groupServerMutators.inviteGuest.fn({
          tx,
          ctx,
          args: {
            id: crypto.randomUUID(),
            group_id: args.group.id,
            user_id: userId,
            status: 'invited',
            role_ids: [guestRoleId],
            invited_by_id: ctx.userID,
          },
        });
      }
    }

    for (const connectionRequest of args.connection_requests ?? []) {
      await networkServerMutators.proposeGroupConnectionChange.fn({
        tx,
        ctx,
        args: connectionRequest,
      });
    }

    if (args.founding_event) {
      await eventServerMutators.create.fn({
        tx,
        ctx,
        args: args.founding_event,
      });
    }
  }),

  createOfflineMember: defineMutator(groupOfflineMemberCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.createOfflineMember.fn({ tx, ctx, args });
    const affectedMembershipGroupIds = new Set<string>([args.group_id]);
    const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
      tx,
      [args.group_id],
      ctx.userID
    );
    for (const affectedGroupId of reconciledGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  updateOfflineMember: defineMutator(groupOfflineMemberUpdateSchema, async ({ tx, ctx, args }) => {
    const existingOfflineMember = await tx.run(zql.group_offline_member.where('id', args.id).one());

    await mutators.groups.updateOfflineMember.fn({ tx, ctx, args });

    if (!existingOfflineMember) {
      return;
    }

    const affectedMembershipGroupIds = new Set<string>([existingOfflineMember.group_id]);
    const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
      tx,
      [existingOfflineMember.group_id],
      ctx.userID
    );
    for (const affectedGroupId of reconciledGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  deleteOfflineMember: defineMutator(groupOfflineMemberDeleteSchema, async ({ tx, ctx, args }) => {
    const existingOfflineMember = await tx.run(zql.group_offline_member.where('id', args.id).one());

    await mutators.groups.deleteOfflineMember.fn({ tx, ctx, args });

    if (!existingOfflineMember) {
      return;
    }

    const affectedMembershipGroupIds = new Set<string>([existingOfflineMember.group_id]);
    const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
      tx,
      [existingOfflineMember.group_id],
      ctx.userID
    );
    for (const affectedGroupId of reconciledGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  importOfflineMembers: defineMutator(
    groupOfflineMemberBulkImportSchema,
    async ({ tx, ctx, args }) => {
      await mutators.groups.importOfflineMembers.fn({ tx, ctx, args });
      const affectedMembershipGroupIds = new Set<string>([args.group_id]);
      const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
        tx,
        [args.group_id],
        ctx.userID
      );
      for (const affectedGroupId of reconciledGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }

      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        affectedMembershipGroupIds,
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  ),

  joinGroup: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    const group = await loadGroupWithDerivedNetworkMeta(tx, args.group_id);
    const affectedMembershipGroupIds = new Set<string>([args.group_id]);

    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'membership_activation',
      group_id: args.group_id,
      user_id: ctx.userID,
    });

    // Run shared mutator (guards + direct insert)
    await mutators.groups.joinGroup.fn({ tx, ctx, args });

    await recomputeGroupCounters(tx, args.group_id);
    await recomputeUserCounters(tx, ctx.userID);

    if (args.status === 'requested' && args.group_id) {
      const [gName, uName] = await Promise.all([
        groupName(tx, args.group_id),
        userName(tx, ctx.userID),
      ]);
      fireNotification('notifyMembershipRequest', {
        senderId: ctx.userID,
        senderName: uName,
        groupId: args.group_id,
        groupName: gName,
      });
    }

    if (isActiveGroupStatus(args.status)) {
      await syncUserWithGroupConversation(tx, {
        groupId: args.group_id,
        userId: ctx.userID,
      });
    }

    // Only accepted base-group memberships should materialize into hierarchy ancestors.
    if (!group || group.group_type !== 'base' || !isActiveGroupStatus(args.status)) {
      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        affectedMembershipGroupIds,
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
      return;
    }

    const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
      tx,
      [args.group_id],
      ctx.userID
    );
    for (const affectedGroupId of reconciledGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  inviteMember: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'membership_activation',
      group_id: args.group_id,
      user_id: args.user_id,
    });

    await mutators.groups.inviteMember.fn({ tx, ctx, args });

    if (args.user_id && args.group_id) {
      const gName = await groupName(tx, args.group_id);
      fireNotification('notifyGroupInvite', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        groupId: args.group_id,
        groupName: gName,
      });
    }
  }),

  addMembershipRole: defineMutator(groupMembershipRoleAssignSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(
      zql.group_membership.where('id', args.group_membership_id).one()
    );
    const previousRoleIds = membership
      ? await groupMembershipRoleIds(tx, args.group_membership_id)
      : [];

    await mutators.groups.addMembershipRole.fn({ tx, ctx, args });

    if (!membership) {
      return;
    }

    await notifyActiveMembershipRoleChange(tx, ctx.userID, membership, previousRoleIds);

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      [membership.group_id],
      ctx.userID
    );
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  removeMembershipRole: defineMutator(
    groupMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await tx.run(
        zql.group_membership.where('id', args.group_membership_id).one()
      );
      const previousRoleIds = membership
        ? await groupMembershipRoleIds(tx, args.group_membership_id)
        : [];

      await mutators.groups.removeMembershipRole.fn({ tx, ctx, args });

      if (!membership) {
        return;
      }

      await notifyActiveMembershipRoleChange(tx, ctx.userID, membership, previousRoleIds);

      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        [membership.group_id],
        ctx.userID
      );
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  ),

  syncMembershipRoles: defineMutator(groupMembershipRolesSyncSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(
      zql.group_membership.where('id', args.group_membership_id).one()
    );
    const previousRoleIds = membership
      ? await groupMembershipRoleIds(tx, args.group_membership_id)
      : [];

    await mutators.groups.syncMembershipRoles.fn({ tx, ctx, args });

    if (!membership) {
      return;
    }

    await notifyActiveMembershipRoleChange(tx, ctx.userID, membership, previousRoleIds);

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      [membership.group_id],
      ctx.userID
    );
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  addOfflineMembershipRole: defineMutator(
    groupOfflineMembershipRoleAssignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await tx.run(
        zql.group_offline_membership.where('id', args.group_offline_membership_id).one()
      );

      await mutators.groups.addOfflineMembershipRole.fn({ tx, ctx, args });

      if (!membership) {
        return;
      }

      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        [membership.group_id],
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  ),

  removeOfflineMembershipRole: defineMutator(
    groupOfflineMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await tx.run(
        zql.group_offline_membership.where('id', args.group_offline_membership_id).one()
      );

      await mutators.groups.removeOfflineMembershipRole.fn({ tx, ctx, args });

      if (!membership) {
        return;
      }

      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        [membership.group_id],
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  ),

  syncOfflineMembershipRoles: defineMutator(
    groupOfflineMembershipRolesSyncSchema,
    async ({ tx, ctx, args }) => {
      const membership = await tx.run(
        zql.group_offline_membership.where('id', args.group_offline_membership_id).one()
      );

      await mutators.groups.syncOfflineMembershipRoles.fn({ tx, ctx, args });

      if (!membership) {
        return;
      }

      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        [membership.group_id],
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  ),

  requestGuestAccess: defineMutator(groupGuestAccessCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.requestGuestAccess.fn({ tx, ctx, args });

    const [gName, uName] = await Promise.all([
      groupName(tx, args.group_id),
      userName(tx, ctx.userID),
    ]);
    fireNotification('notifyGuestAccessRequest', {
      senderId: ctx.userID,
      senderName: uName,
      groupId: args.group_id,
      groupName: gName,
    });
  }),

  inviteGuest: defineMutator(groupGuestAccessCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.inviteGuest.fn({ tx, ctx, args });

    if (args.user_id && args.group_id) {
      const gName = await groupName(tx, args.group_id);
      fireNotification('notifyGuestAccessInvite', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        groupId: args.group_id,
        groupName: gName,
      });
    }

    if (args.status === 'active') {
      await syncUserWithGroupConversation(tx, {
        groupId: args.group_id,
        userId: args.user_id,
      });
    }
  }),

  acceptGuestInvitation: defineMutator(groupGuestAccessAcceptSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(zql.group_guest_access.where('id', args.id).one());

    await mutators.groups.acceptGuestInvitation.fn({ tx, ctx, args });

    if (!guestAccess) {
      return;
    }

    await syncUserWithGroupConversation(tx, {
      groupId: guestAccess.group_id,
      userId: guestAccess.user_id,
    });

    const [gName, uName] = await Promise.all([
      groupName(tx, guestAccess.group_id),
      userName(tx, guestAccess.user_id),
    ]);
    const isSelf = ctx.userID === guestAccess.user_id;

    if (isSelf) {
      fireNotification('notifyGroupInvitationAccepted', {
        senderId: ctx.userID,
        senderName: uName,
        groupId: guestAccess.group_id,
        groupName: gName,
      });
    } else {
      fireNotification('notifyGuestAccessApproved', {
        senderId: ctx.userID,
        recipientUserId: guestAccess.user_id,
        groupId: guestAccess.group_id,
        groupName: gName,
      });
    }
  }),

  revokeGuestAccess: defineMutator(groupGuestAccessDeleteSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(zql.group_guest_access.where('id', args.id).one());

    await mutators.groups.revokeGuestAccess.fn({ tx, ctx, args });

    if (!guestAccess) {
      return;
    }

    await syncUserWithGroupConversation(tx, {
      groupId: guestAccess.group_id,
      userId: guestAccess.user_id,
    });

    const gId = guestAccess.group_id;
    const guestUserId = guestAccess.user_id;
    const status = guestAccess.status;
    const isSelf = ctx.userID === guestUserId;

    const [gName, uName] = await Promise.all([groupName(tx, gId), userName(tx, guestUserId)]);

    if (isSelf) {
      if (status === 'requested') {
        fireNotification('notifyGroupRequestWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      } else if (status === 'invited') {
        fireNotification('notifyGroupInvitationDeclined', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      } else {
        fireNotification('notifyGuestAccessWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      }
    } else if (status === 'requested') {
      fireNotification('notifyMembershipRejected', {
        senderId: ctx.userID,
        recipientUserId: guestUserId,
        groupId: gId,
        groupName: gName,
      });
    } else {
      fireNotification('notifyGuestAccessRemoved', {
        senderId: ctx.userID,
        recipientUserId: guestUserId,
        groupId: gId,
        groupName: gName,
      });
    }
  }),

  addGuestRole: defineMutator(groupGuestRoleAssignSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(
      zql.group_guest_access.where('id', args.group_guest_access_id).one()
    );
    const previousRoleIds = guestAccess
      ? await groupGuestRoleIds(tx, args.group_guest_access_id)
      : [];

    await mutators.groups.addGuestRole.fn({ tx, ctx, args });

    if (!guestAccess) return;
    await notifyActiveGuestAccessRoleChange(tx, ctx.userID, guestAccess, previousRoleIds);
  }),

  removeGuestRole: defineMutator(groupGuestRoleUnassignSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(
      zql.group_guest_access.where('id', args.group_guest_access_id).one()
    );
    const previousRoleIds = guestAccess
      ? await groupGuestRoleIds(tx, args.group_guest_access_id)
      : [];

    await mutators.groups.removeGuestRole.fn({ tx, ctx, args });

    if (!guestAccess) return;
    await notifyActiveGuestAccessRoleChange(tx, ctx.userID, guestAccess, previousRoleIds);
  }),

  syncGuestRoles: defineMutator(groupGuestRolesSyncSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(
      zql.group_guest_access.where('id', args.group_guest_access_id).one()
    );
    const previousRoleIds = guestAccess
      ? await groupGuestRoleIds(tx, args.group_guest_access_id)
      : [];

    await mutators.groups.syncGuestRoles.fn({ tx, ctx, args });

    if (!guestAccess) return;
    await notifyActiveGuestAccessRoleChange(tx, ctx.userID, guestAccess, previousRoleIds);
  }),

  acceptInvitation: defineMutator(z.object({ id: z.string() }), async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    const affectedMembershipGroupIds = new Set<string>();

    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'membership_activation',
      membership_id: args.id,
    });

    await mutators.groups.acceptInvitation.fn({ tx, ctx, args });

    if (!membership) return;
    affectedMembershipGroupIds.add(membership.group_id);

    await recomputeGroupCounters(tx, membership.group_id);
    await recomputeUserCounters(tx, membership.user_id);

    const [gName, uName] = await Promise.all([
      groupName(tx, membership.group_id),
      userName(tx, ctx.userID),
    ]);
    fireNotification('notifyGroupInvitationAccepted', {
      senderId: ctx.userID,
      senderName: uName,
      groupId: membership.group_id,
      groupName: gName,
    });

    await syncUserWithGroupConversation(tx, {
      groupId: membership.group_id,
      userId: membership.user_id,
    });

    // Propagate derived memberships when accepting invitation to a base group
    const group = await loadGroupWithDerivedNetworkMeta(tx, membership.group_id);
    if (!group || group.group_type !== 'base') {
      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        affectedMembershipGroupIds,
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
      return;
    }

    const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
      tx,
      [membership.group_id],
      ctx.userID
    );
    for (const affectedGroupId of reconciledGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  leaveGroup: defineMutator(groupMembershipDeleteSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    const affectedMembershipGroupIds = new Set<string>();

    await mutators.groups.leaveGroup.fn({ tx, ctx, args });

    if (!membership) return;
    affectedMembershipGroupIds.add(membership.group_id);

    await recomputeGroupCounters(tx, membership.group_id);
    await recomputeUserCounters(tx, membership.user_id);
    await syncUserWithGroupConversation(tx, {
      groupId: membership.group_id,
      userId: membership.user_id,
    });

    if (membership.source === 'direct') {
      const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
        tx,
        [membership.group_id],
        ctx.userID
      );
      for (const affectedGroupId of reconciledGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }
    }

    const gId = membership.group_id;
    const membUserId = membership.user_id;
    const status = membership.status;
    const isSelf = ctx.userID === membUserId;

    const [gName, uName] = await Promise.all([groupName(tx, gId), userName(tx, membUserId)]);

    if (isSelf) {
      if (status === 'requested') {
        fireNotification('notifyGroupRequestWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      } else if (status === 'invited') {
        fireNotification('notifyGroupInvitationDeclined', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      } else {
        fireNotification('notifyMembershipWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      }
    } else {
      if (status === 'requested') {
        fireNotification('notifyMembershipRejected', {
          senderId: ctx.userID,
          recipientUserId: membUserId,
          groupId: gId,
          groupName: gName,
        });
      } else {
        fireNotification('notifyMembershipRemoved', {
          senderId: ctx.userID,
          recipientUserId: membUserId,
          groupId: gId,
          groupName: gName,
        });
      }
    }

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      affectedMembershipGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
  }),

  updateMembership: defineMutator(groupMembershipUpdateSchema, async ({ tx, ctx, args }) => {
    const oldMembership = await tx.run(zql.group_membership.where('id', args.id).one());
    const affectedMembershipGroupIds = new Set<string>();
    if (
      oldMembership &&
      args.status !== undefined &&
      isActiveGroupStatus(args.status) &&
      !isActiveGroupStatus(oldMembership.status)
    ) {
      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'membership_activation',
        membership_id: args.id,
      });
    }

    await mutators.groups.updateMembership.fn({ tx, ctx, args });

    if (!oldMembership) return;
    affectedMembershipGroupIds.add(oldMembership.group_id);

    await recomputeGroupCounters(tx, oldMembership.group_id);
    await recomputeUserCounters(tx, oldMembership.user_id);

    const gId = oldMembership.group_id;
    const membUserId = oldMembership.user_id;
    const oldStatus = oldMembership.status;
    const newStatus = args.status;
    const isSelf = ctx.userID === membUserId;
    const becameActive =
      newStatus !== undefined && isActiveGroupStatus(newStatus) && !isActiveGroupStatus(oldStatus);
    const lostActiveAccess =
      newStatus !== undefined && !isActiveGroupStatus(newStatus) && isActiveGroupStatus(oldStatus);

    const gName = await groupName(tx, gId);

    if (newStatus === 'active' && (oldStatus === 'requested' || oldStatus === 'invited')) {
      if (isSelf) {
        const uName = await userName(tx, ctx.userID);
        fireNotification('notifyGroupInvitationAccepted', {
          senderId: ctx.userID,
          senderName: uName,
          groupId: gId,
          groupName: gName,
        });
      } else {
        fireNotification('notifyMembershipApproved', {
          senderId: ctx.userID,
          recipientUserId: membUserId,
          groupId: gId,
          groupName: gName,
        });
      }
    } else if (newStatus === 'admin') {
      fireNotification('notifyAdminPromoted', {
        senderId: ctx.userID,
        recipientUserId: membUserId,
        groupId: gId,
        groupName: gName,
      });
    } else if (newStatus === 'active' && oldStatus === 'admin') {
      fireNotification('notifyAdminDemoted', {
        senderId: ctx.userID,
        recipientUserId: membUserId,
        groupId: gId,
        groupName: gName,
      });
    }

    // Keep derived memberships and linked conversations aligned with active base memberships.
    if (becameActive || lostActiveAccess) {
      const group = await loadGroupWithDerivedNetworkMeta(tx, gId);
      if (group?.group_type === 'base') {
        const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
          tx,
          [gId],
          ctx.userID
        );
        for (const affectedGroupId of reconciledGroupIds) {
          affectedMembershipGroupIds.add(affectedGroupId);
        }
      }
    }

    if (args.status !== undefined) {
      await syncUserWithGroupConversation(tx, {
        groupId: gId,
        userId: membUserId,
      });
    }

    if (becameActive || lostActiveAccess) {
      const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
        tx,
        affectedMembershipGroupIds,
        ctx.userID
      );
      await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
      await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);
    }
  }),

  update: defineMutator(groupUpdateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.update.fn({ tx, ctx, args });
    const directlyAffectedGroupIds = new Set<string>([args.id]);

    const expandedAffectedGroupIds = await expandAffectedGroupsWithSiblingMemberships(
      tx,
      directlyAffectedGroupIds,
      ctx.userID
    );
    await recomputeGroupCountersForGroups(tx, expandedAffectedGroupIds);
    await reconcileMembershipDrivenEventsForGroups(tx, expandedAffectedGroupIds, ctx.userID);

    const gName = args.name ?? (await groupName(tx, args.id));
    fireNotification('notifyGroupProfileUpdated', {
      senderId: ctx.userID,
      groupId: args.id,
      groupName: gName,
    });
  }),

  createRole: defineMutator(roleCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.createRole.fn({ tx, ctx, args });

    if (args.group_id) {
      const gName = await groupName(tx, args.group_id);
      fireNotification('notifyAccessRoleCreated', {
        senderId: ctx.userID,
        groupId: args.group_id,
        groupName: gName,
        roleName: args.name,
      });
    } else if (args.blog_id) {
      const blogContext = await loadBlogRoleNotificationContext(tx, args.blog_id);
      fireNotification('notifyBlogRoleCreated', {
        senderId: ctx.userID,
        blogId: args.blog_id,
        blogTitle: blogContext.blogTitle,
        roleName: args.name,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  deleteRole: defineMutator(roleDeleteSchema, async ({ tx, ctx, args }) => {
    const rInfo = await roleName(tx, args.id);

    await mutators.groups.deleteRole.fn({ tx, ctx, args });

    if (rInfo.groupId) {
      const gName = await groupName(tx, rInfo.groupId);
      fireNotification('notifyAccessRoleDeleted', {
        senderId: ctx.userID,
        groupId: rInfo.groupId,
        groupName: gName,
        roleName: rInfo.name,
      });
    } else if (rInfo.blogId) {
      const blogContext = await loadBlogRoleNotificationContext(tx, rInfo.blogId);
      fireNotification('notifyBlogRoleDeleted', {
        senderId: ctx.userID,
        blogId: rInfo.blogId,
        blogTitle: blogContext.blogTitle,
        roleName: rInfo.name,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  assignActionRight: defineMutator(actionRightCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.assignActionRight.fn({ tx, ctx, args });

    if (args.role_id && args.group_id) {
      const [gName, rInfo] = await Promise.all([
        groupName(tx, args.group_id),
        roleName(tx, args.role_id),
      ]);
      fireNotification('notifyActionRightsChanged', {
        senderId: ctx.userID,
        groupId: args.group_id,
        groupName: gName,
        roleName: rInfo.name,
      });
    } else if (args.role_id && args.event_id) {
      const [eTitle, rInfo] = await Promise.all([
        eventTitle(tx, args.event_id),
        roleName(tx, args.role_id),
      ]);
      fireNotification('notifyEventRoleUpdated', {
        senderId: ctx.userID,
        eventId: args.event_id,
        eventTitle: eTitle,
        roleTitle: rInfo.name,
      });
    } else if (args.role_id && args.amendment_id) {
      const [aTitle, rInfo] = await Promise.all([
        amendmentTitle(tx, args.amendment_id),
        roleName(tx, args.role_id),
      ]);
      fireNotification('notifyAmendmentRoleUpdated', {
        senderId: ctx.userID,
        amendmentId: args.amendment_id,
        amendmentTitle: aTitle,
        roleName: rInfo.name,
      });
    } else if (args.role_id && args.blog_id) {
      const [blogContext, rInfo] = await Promise.all([
        loadBlogRoleNotificationContext(tx, args.blog_id),
        roleName(tx, args.role_id),
      ]);
      fireNotification('notifyBlogRoleUpdated', {
        senderId: ctx.userID,
        blogId: args.blog_id,
        blogTitle: blogContext.blogTitle,
        roleName: rInfo.name,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  removeActionRight: defineMutator(actionRightDeleteSchema, async ({ tx, ctx, args }) => {
    const right = await tx.run(zql.action_right.where('id', args.id).one());

    await mutators.groups.removeActionRight.fn({ tx, ctx, args });

    if (right?.role_id && right?.group_id) {
      const [gName, rInfo] = await Promise.all([
        groupName(tx, right.group_id),
        roleName(tx, right.role_id),
      ]);
      fireNotification('notifyActionRightsChanged', {
        senderId: ctx.userID,
        groupId: right.group_id,
        groupName: gName,
        roleName: rInfo.name,
      });
    } else if (right?.role_id && right?.event_id) {
      const [eTitle, rInfo] = await Promise.all([
        eventTitle(tx, right.event_id),
        roleName(tx, right.role_id),
      ]);
      fireNotification('notifyEventRoleUpdated', {
        senderId: ctx.userID,
        eventId: right.event_id,
        eventTitle: eTitle,
        roleTitle: rInfo.name,
      });
    } else if (right?.role_id && right?.amendment_id) {
      const [aTitle, rInfo] = await Promise.all([
        amendmentTitle(tx, right.amendment_id),
        roleName(tx, right.role_id),
      ]);
      fireNotification('notifyAmendmentRoleUpdated', {
        senderId: ctx.userID,
        amendmentId: right.amendment_id,
        amendmentTitle: aTitle,
        roleName: rInfo.name,
      });
    } else if (right?.role_id && right?.blog_id) {
      const [blogContext, rInfo] = await Promise.all([
        loadBlogRoleNotificationContext(tx, right.blog_id),
        roleName(tx, right.role_id),
      ]);
      fireNotification('notifyBlogRoleUpdated', {
        senderId: ctx.userID,
        blogId: right.blog_id,
        blogTitle: blogContext.blogTitle,
        roleName: rInfo.name,
        groupId: blogContext.groupId,
        ownerId: blogContext.ownerId,
      });
    }
  }),

  createRoleHolderHistory: defineMutator(
    roleHolderHistoryCreateSchema,
    async ({ tx, ctx, args }) => {
      await mutators.groups.createRoleHolderHistory.fn({ tx, ctx, args });

      if (args.role_id) {
        const pos = await tx.run(zql.role.where('id', args.role_id).one());
        if (pos?.group_id && args.user_id) {
          const gName = await groupName(tx, pos.group_id);
          fireNotification('notifyRoleAssigned', {
            senderId: ctx.userID,
            recipientUserId: args.user_id,
            groupId: pos.group_id,
            groupName: gName,
            roleTitle: pos.name,
          });
        }
      }
    }
  ),

  updateRoleHolderHistory: defineMutator(
    roleHolderHistoryUpdateSchema,
    async ({ tx, ctx, args }) => {
      const oldHistory = await tx.run(zql.role_holder_history.where('id', args.id).one());

      await mutators.groups.updateRoleHolderHistory.fn({ tx, ctx, args });

      if (args.end_date && !oldHistory?.end_date && oldHistory?.role_id) {
        const pos = await tx.run(zql.role.where('id', oldHistory.role_id).one());
        if (pos?.group_id) {
          const gName = await groupName(tx, pos.group_id);
          fireNotification('notifyRoleVacated', {
            senderId: ctx.userID,
            groupId: pos.group_id,
            groupName: gName,
            roleTitle: pos.name,
          });
        }
      }
    }
  ),
};
