import { defineMutator } from '@rocicorp/zero';
import { z } from 'zod';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import {
  blogTitle,
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
import {
  groupCreateSchema,
  groupMembershipCreateSchema,
  groupMembershipDeleteSchema,
  groupOfflineMemberCreateSchema,
  groupOfflineMemberUpdateSchema,
  groupOfflineMemberDeleteSchema,
  groupOfflineMemberBulkImportSchema,
  groupMembershipLegacyRoleUpdateSchema,
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
  createGroupRelationshipSchema,
  updateGroupRelationshipSchema,
  deleteGroupRelationshipSchema,
} from '../network/schema';
import { resolveChildBaseGroups } from '../../features/groups/logic/hierarchy';
import {
  clearAutomaticSiblingMemberships,
  filterHierarchyRelationships,
  reconcileHierarchyForBaseGroup,
  recomputeSiblingGroupMemberships,
  recomputeSiblingMembershipsForGroup,
} from './membership-helpers';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';
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
type GroupServerCtx = Parameters<typeof mutators.groups.create.fn>[0]['ctx'];

async function reconcileBaseGroupHierarchyMemberships(
  tx: GroupServerTx,
  baseGroupIds: readonly string[],
  assignedById?: string | null
) {
  const affectedMembershipGroupIds = new Set<string>();

  for (const baseGroupId of [...new Set(baseGroupIds.filter(Boolean))]) {
    const { affectedGroupIds } = await reconcileHierarchyForBaseGroup(
      tx,
      baseGroupId,
      assignedById
    );
    for (const affectedGroupId of affectedGroupIds) {
      affectedMembershipGroupIds.add(affectedGroupId);
    }
  }

  return affectedMembershipGroupIds;
}

async function applyActivatedHierarchyRelationshipEffects(
  tx: GroupServerTx,
  ctx: GroupServerCtx,
  relationship: {
    id: string;
    group_id: string;
    related_group_id: string;
    relationship_type: string | null;
    with_right: string | null;
  }
) {
  const hierarchyPair = getHierarchyRelationshipPair(relationship);
  if (!hierarchyPair) {
    return new Set<string>();
  }

  const parentGroupId = hierarchyPair.parentGroupId;
  const childGroupId = hierarchyPair.childGroupId;
  const allGroups = await tx.run(zql.group);
  const groupsById = new Map(allGroups.map(group => [group.id, group]));
  const parentGroup = groupsById.get(parentGroupId) ?? null;
  const childGroup = groupsById.get(childGroupId) ?? null;

  if (parentGroup?.group_type === 'sibling' || childGroup?.group_type === 'sibling') {
    return new Set<string>();
  }

  const affectedMembershipGroupIds = new Set<string>([parentGroupId]);

  if (parentGroup?.group_type === 'base') {
    await tx.mutate.group.update({ id: parentGroupId, group_type: 'hierarchical' });

    const parentRoles = await tx.run(
      zql.role.where('group_id', parentGroupId).where('scope', 'group')
    );
    const adminRole = parentRoles.find(
      role => role.name === 'Admin' && role.assignee_kind !== 'guest'
    );

    if (adminRole) {
      const existingMembers = await tx.run(
        zql.group_membership.where('group_id', parentGroupId).where('source', 'direct')
      );
      for (const member of existingMembers) {
        await addGroupMembershipRoleLink(tx, {
          group_membership_id: member.id,
          role_id: adminRole.id,
          assigned_by_id: ctx.userID,
        });
      }
    }
  }

  const activePvrRelationships = filterHierarchyRelationships(
    await tx.run(
      zql.group_relationship.where('with_right', 'passiveVotingRight').where('status', 'active')
    ),
    groupsById
  );
  const baseGroupIds = resolveChildBaseGroups(childGroupId, activePvrRelationships, groupsById);
  const affectedBaseGroupIds = baseGroupIds.length > 0 ? baseGroupIds : [childGroupId];
  const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
    tx,
    affectedBaseGroupIds,
    ctx.userID
  );

  for (const affectedGroupId of reconciledGroupIds) {
    affectedMembershipGroupIds.add(affectedGroupId);
  }

  return affectedMembershipGroupIds;
}

async function applyDeletedHierarchyRelationshipEffects(
  tx: GroupServerTx,
  ctx: GroupServerCtx,
  relationship: {
    id: string;
    group_id: string;
    related_group_id: string;
    relationship_type: string | null;
    with_right: string | null;
    status: string | null;
  }
) {
  const hierarchyPair = getHierarchyRelationshipPair(relationship);
  if (!hierarchyPair) {
    return new Set<string>();
  }

  const parentGroupId = hierarchyPair.parentGroupId;
  const childGroupId = hierarchyPair.childGroupId;
  const allGroups = await tx.run(zql.group);
  const groupsById = new Map(allGroups.map(group => [group.id, group]));
  const parentGroup = groupsById.get(parentGroupId) ?? null;
  const childGroup = groupsById.get(childGroupId) ?? null;

  if (parentGroup?.group_type === 'sibling' || childGroup?.group_type === 'sibling') {
    return new Set<string>();
  }

  const remainingPvrRelationships = filterHierarchyRelationships(
    await tx.run(
      zql.group_relationship.where('with_right', 'passiveVotingRight').where('status', 'active')
    ),
    groupsById
  );
  const baseGroupIds = resolveChildBaseGroups(childGroupId, remainingPvrRelationships, groupsById);
  const affectedBaseGroupIds = baseGroupIds.length > 0 ? baseGroupIds : [childGroupId];
  const affectedMembershipGroupIds = new Set<string>([parentGroupId]);
  const reconciledGroupIds = await reconcileBaseGroupHierarchyMemberships(
    tx,
    affectedBaseGroupIds,
    ctx.userID
  );

  for (const affectedGroupId of reconciledGroupIds) {
    affectedMembershipGroupIds.add(affectedGroupId);
  }

  const remainingChildren = remainingPvrRelationships.filter(currentRelationship => {
    const pair = getHierarchyRelationshipPair(currentRelationship);
    return pair?.parentGroupId === parentGroupId;
  });

  if (
    remainingChildren.length === 0 &&
    (await tx.run(zql.group.where('id', parentGroupId).one()))?.group_type === 'hierarchical'
  ) {
    await tx.mutate.group.update({ id: parentGroupId, group_type: 'base' });
  }

  return affectedMembershipGroupIds;
}

function isGraphActiveRelationshipStatus(status: string | null | undefined) {
  return status == null || status === 'active' || status === 'accepted';
}

async function recomputeSiblingMembershipsForGroups(
  tx: GroupServerTx,
  groupIds: Iterable<string>,
  assignedById?: string | null
) {
  for (const groupId of new Set([...groupIds].filter(Boolean))) {
    await recomputeSiblingMembershipsForGroup(tx, groupId, assignedById);
  }
}

async function reconcileMembershipDrivenEventsForGroups(
  tx: GroupServerTx,
  groupIds: Iterable<string>,
  assignedById?: string | null
) {
  const uniqueGroupIds = [...new Set([...groupIds].filter(Boolean))];
  if (uniqueGroupIds.length === 0) {
    console.info('Server successful', {
      flow: 'group-membership-event-reconcile',
      assignedById: assignedById ?? null,
      groupIds: [],
      reason: 'no-groups',
    });
    return;
  }

  console.info('Server validation started', {
    flow: 'group-membership-event-reconcile',
    assignedById: assignedById ?? null,
    groupIds: uniqueGroupIds,
  });

  await reconcileGeneralAssemblyParticipantsForGroups(tx, uniqueGroupIds, assignedById);
  await reconcileDelegateAllocationsForGroups(tx, uniqueGroupIds);

  console.info('Server successful', {
    flow: 'group-membership-event-reconcile',
    assignedById: assignedById ?? null,
    groupIds: uniqueGroupIds,
  });
}

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const groupServerMutators = {
  create: defineMutator(groupCreateSchema, async ({ tx, ctx, args }) => {
    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'sibling_configuration',
      group_id: args.id,
      group_type: args.group_type,
      connected_group_id: args.connected_group_id ?? null,
      sibling_membership_mode: args.sibling_membership_mode ?? null,
      sibling_role_id: args.sibling_role_id ?? null,
      parliament_source_group_ids: args.parliament_source_group_ids ?? [],
    });

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

    const shouldCreateCreatorMembership =
      args.group_type !== 'sibling' || args.sibling_membership_mode === 'open';

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

    if (args.group_type === 'sibling') {
      await recomputeSiblingGroupMemberships(tx, args.id, ctx.userID);
    }
  }),

  createOfflineMember: defineMutator(groupOfflineMemberCreateSchema, async ({ tx, ctx, args }) => {
    console.info('Server validation started', {
      flow: 'group-offline-member-create',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      groupId: args.group_id,
    });

    await mutators.groups.createOfflineMember.fn({ tx, ctx, args });
    await recomputeGroupCounters(tx, args.group_id);
    await reconcileMembershipDrivenEventsForGroups(tx, [args.group_id], ctx.userID);

    console.info('Server successful', {
      flow: 'group-offline-member-create',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      groupId: args.group_id,
      offlineMemberId: args.id,
    });
  }),

  updateOfflineMember: defineMutator(groupOfflineMemberUpdateSchema, async ({ tx, ctx, args }) => {
    const existingOfflineMember = await tx.run(zql.group_offline_member.where('id', args.id).one());

    console.info('Server validation started', {
      flow: 'group-offline-member-update',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      groupId: existingOfflineMember?.group_id ?? null,
      offlineMemberId: args.id,
    });

    await mutators.groups.updateOfflineMember.fn({ tx, ctx, args });

    if (!existingOfflineMember) {
      return;
    }

    await recomputeGroupCounters(tx, existingOfflineMember.group_id);
    await reconcileMembershipDrivenEventsForGroups(
      tx,
      [existingOfflineMember.group_id],
      ctx.userID
    );

    console.info('Server successful', {
      flow: 'group-offline-member-update',
      correlationId: args.debug_correlation_id ?? null,
      actorUserId: ctx.userID,
      groupId: existingOfflineMember.group_id,
      offlineMemberId: args.id,
    });
  }),

  deleteOfflineMember: defineMutator(groupOfflineMemberDeleteSchema, async ({ tx, ctx, args }) => {
    const existingOfflineMember = await tx.run(zql.group_offline_member.where('id', args.id).one());

    console.info('Server validation started', {
      flow: 'group-offline-member-delete',
      actorUserId: ctx.userID,
      groupId: existingOfflineMember?.group_id ?? null,
      offlineMemberId: args.id,
    });

    await mutators.groups.deleteOfflineMember.fn({ tx, ctx, args });

    if (!existingOfflineMember) {
      return;
    }

    await recomputeGroupCounters(tx, existingOfflineMember.group_id);
    await reconcileMembershipDrivenEventsForGroups(
      tx,
      [existingOfflineMember.group_id],
      ctx.userID
    );

    console.info('Server successful', {
      flow: 'group-offline-member-delete',
      actorUserId: ctx.userID,
      groupId: existingOfflineMember.group_id,
      offlineMemberId: args.id,
    });
  }),

  importOfflineMembers: defineMutator(
    groupOfflineMemberBulkImportSchema,
    async ({ tx, ctx, args }) => {
      console.info('Server validation started', {
        flow: 'group-offline-member-import',
        correlationId: args.debug_correlation_id ?? null,
        actorUserId: ctx.userID,
        groupId: args.group_id,
        entryCount: args.entries.length,
      });

      await mutators.groups.importOfflineMembers.fn({ tx, ctx, args });
      await recomputeGroupCounters(tx, args.group_id);
      await reconcileMembershipDrivenEventsForGroups(tx, [args.group_id], ctx.userID);

      console.info('Server successful', {
        flow: 'group-offline-member-import',
        correlationId: args.debug_correlation_id ?? null,
        actorUserId: ctx.userID,
        groupId: args.group_id,
        entryCount: args.entries.length,
      });
    }
  ),

  joinGroup: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    const group = await tx.run(zql.group.where('id', args.group_id).one());
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
      await recomputeSiblingMembershipsForGroup(tx, args.group_id, ctx.userID);
      await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
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

    for (const affectedGroupId of affectedMembershipGroupIds) {
      await recomputeSiblingMembershipsForGroup(tx, affectedGroupId, ctx.userID);
    }

    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
  }),

  inviteMember: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
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

    await mutators.groups.addMembershipRole.fn({ tx, ctx, args });

    if (!membership) {
      return;
    }

    await recomputeSiblingMembershipsForGroup(tx, membership.group_id, ctx.userID);
  }),

  removeMembershipRole: defineMutator(
    groupMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await tx.run(
        zql.group_membership.where('id', args.group_membership_id).one()
      );

      await mutators.groups.removeMembershipRole.fn({ tx, ctx, args });

      if (!membership) {
        return;
      }

      await recomputeSiblingMembershipsForGroup(tx, membership.group_id, ctx.userID);
    }
  ),

  syncMembershipRoles: defineMutator(groupMembershipRolesSyncSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(
      zql.group_membership.where('id', args.group_membership_id).one()
    );

    await mutators.groups.syncMembershipRoles.fn({ tx, ctx, args });

    if (!membership) {
      return;
    }

    await recomputeSiblingMembershipsForGroup(tx, membership.group_id, ctx.userID);
  }),

  inviteGuest: defineMutator(groupGuestAccessCreateSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.inviteGuest.fn({ tx, ctx, args });

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
  }),

  addGuestRole: defineMutator(groupGuestRoleAssignSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.addGuestRole.fn({ tx, ctx, args });
  }),

  removeGuestRole: defineMutator(groupGuestRoleUnassignSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.removeGuestRole.fn({ tx, ctx, args });
  }),

  syncGuestRoles: defineMutator(groupGuestRolesSyncSchema, async ({ tx, ctx, args }) => {
    await mutators.groups.syncGuestRoles.fn({ tx, ctx, args });
  }),

  acceptInvitation: defineMutator(z.object({ id: z.string() }), async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    const affectedMembershipGroupIds = new Set<string>();

    console.info('Server validation started', {
      flow: 'group-membership-invitation-accept',
      membershipId: args.id,
      actorUserId: ctx.userID,
      membershipStatus: membership?.status ?? null,
      membershipGroupId: membership?.group_id ?? null,
      membershipUserId: membership?.user_id ?? null,
      membershipSource: membership?.source ?? null,
    });

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
    const group = await tx.run(zql.group.where('id', membership.group_id).one());
    if (!group || group.group_type !== 'base') {
      await recomputeSiblingMembershipsForGroup(tx, membership.group_id, ctx.userID);
      await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
      console.info('Server successful', {
        flow: 'group-membership-invitation-accept',
        membershipId: args.id,
        actorUserId: ctx.userID,
        membershipGroupId: membership.group_id,
        membershipUserId: membership.user_id,
        affectedMembershipGroupIds: [...affectedMembershipGroupIds],
      });
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

    for (const affectedGroupId of affectedMembershipGroupIds) {
      await recomputeSiblingMembershipsForGroup(tx, affectedGroupId, ctx.userID);
    }

    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);

    console.info('Server successful', {
      flow: 'group-membership-invitation-accept',
      membershipId: args.id,
      actorUserId: ctx.userID,
      membershipGroupId: membership.group_id,
      membershipUserId: membership.user_id,
      affectedMembershipGroupIds: [...affectedMembershipGroupIds],
    });
  }),

  leaveGroup: defineMutator(groupMembershipDeleteSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    const affectedMembershipGroupIds = new Set<string>();

    console.info('Server validation started', {
      flow: 'group-membership-delete',
      membershipId: args.id,
      actorUserId: ctx.userID,
      membershipStatus: membership?.status ?? null,
      membershipGroupId: membership?.group_id ?? null,
      membershipUserId: membership?.user_id ?? null,
      membershipSource: membership?.source ?? null,
    });

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

    for (const affectedGroupId of affectedMembershipGroupIds) {
      await recomputeSiblingMembershipsForGroup(tx, affectedGroupId, ctx.userID);
    }

    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);

    console.info('Server successful', {
      flow: 'group-membership-delete',
      membershipId: args.id,
      actorUserId: ctx.userID,
      membershipGroupId: membership.group_id,
      membershipUserId: membership.user_id,
      affectedMembershipGroupIds: [...affectedMembershipGroupIds],
    });
  }),

  updateMemberRole: defineMutator(
    groupMembershipLegacyRoleUpdateSchema,
    async ({ tx, ctx, args }) => {
      const oldMembership = await tx.run(zql.group_membership.where('id', args.id).one());
      const oldRoleLinks = await tx.run(
        zql.group_membership_role.where('group_membership_id', args.id)
      );
      const affectedMembershipGroupIds = new Set<string>();
      const isActivationTrace =
        oldMembership != null &&
        args.status !== undefined &&
        isActiveGroupStatus(args.status) &&
        !isActiveGroupStatus(oldMembership.status);

      if (isActivationTrace) {
        console.info('Server validation started', {
          flow: 'group-membership-request-approve',
          membershipId: args.id,
          actorUserId: ctx.userID,
          membershipUserId: oldMembership.user_id,
          groupId: oldMembership.group_id,
          oldStatus: oldMembership.status,
          newStatus: args.status,
          source: oldMembership.source,
        });
      }

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

      await mutators.groups.updateMemberRole.fn({ tx, ctx, args });

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
        newStatus !== undefined &&
        isActiveGroupStatus(newStatus) &&
        !isActiveGroupStatus(oldStatus);
      const lostActiveAccess =
        newStatus !== undefined &&
        !isActiveGroupStatus(newStatus) &&
        isActiveGroupStatus(oldStatus);

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

      const oldRoleIds = new Set(oldRoleLinks.map(link => link.role_id));
      const legacyRoleChanged =
        args.role_id !== undefined &&
        (args.role_id
          ? oldRoleIds.size !== 1 || !oldRoleIds.has(args.role_id)
          : oldRoleIds.size > 0);

      if (legacyRoleChanged && !newStatus) {
        const rInfo = args.role_id
          ? await roleName(tx, args.role_id)
          : { name: 'Default', groupId: null };
        fireNotification('notifyMembershipRoleChanged', {
          senderId: ctx.userID,
          recipientUserId: membUserId,
          groupId: gId,
          groupName: gName,
          newRole: rInfo.name,
        });
      }

      // Keep derived memberships and linked conversations aligned with active base memberships.
      if (becameActive || lostActiveAccess) {
        const group = await tx.run(zql.group.where('id', gId).one());
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

      for (const affectedGroupId of affectedMembershipGroupIds) {
        await recomputeSiblingMembershipsForGroup(tx, affectedGroupId, ctx.userID);
      }

      if (becameActive || lostActiveAccess) {
        await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
      }

      if (isActivationTrace) {
        console.info('Server successful', {
          flow: 'group-membership-request-approve',
          membershipId: args.id,
          actorUserId: ctx.userID,
          membershipUserId: oldMembership.user_id,
          groupId: oldMembership.group_id,
          affectedMembershipGroupIds: [...affectedMembershipGroupIds],
        });
      }
    }
  ),

  update: defineMutator(groupUpdateSchema, async ({ tx, ctx, args }) => {
    const previousGroup = await tx.run(zql.group.where('id', args.id).one());
    const nextGroupType = args.group_type ?? previousGroup?.group_type ?? 'base';
    const nextConnectedGroupId =
      args.connected_group_id !== undefined
        ? args.connected_group_id
        : (previousGroup?.connected_group_id ?? null);
    const nextSiblingMembershipMode =
      args.sibling_membership_mode !== undefined
        ? args.sibling_membership_mode
        : (previousGroup?.sibling_membership_mode ?? null);
    const nextSiblingRoleId =
      args.sibling_role_id !== undefined
        ? args.sibling_role_id
        : (previousGroup?.sibling_role_id ?? null);
    const nextParliamentSourceGroupIds =
      args.parliament_source_group_ids ??
      (await tx.run(zql.group_sibling_source.where('group_id', args.id))).map(
        sourceLink => sourceLink.source_group_id
      );

    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'sibling_configuration',
      group_id: args.id,
      group_type: nextGroupType,
      connected_group_id: nextConnectedGroupId,
      sibling_membership_mode: nextSiblingMembershipMode,
      sibling_role_id: nextSiblingRoleId,
      parliament_source_group_ids: nextParliamentSourceGroupIds,
    });

    await mutators.groups.update.fn({ tx, ctx, args });
    const updatedGroup = await tx.run(zql.group.where('id', args.id).one());

    if (previousGroup?.group_type === 'sibling' && updatedGroup?.group_type !== 'sibling') {
      await clearAutomaticSiblingMemberships(tx, args.id);
    }

    if (updatedGroup?.group_type === 'sibling') {
      await recomputeSiblingGroupMemberships(tx, args.id, ctx.userID);
      await recomputeSiblingMembershipsForGroup(tx, args.id, ctx.userID);
    }

    const affectedConnectedGroupIds = new Set<string>();
    if (previousGroup?.connected_group_id) {
      affectedConnectedGroupIds.add(previousGroup.connected_group_id);
    }
    if (updatedGroup?.connected_group_id) {
      affectedConnectedGroupIds.add(updatedGroup.connected_group_id);
    }
    for (const connectedGroupId of affectedConnectedGroupIds) {
      await recomputeSiblingMembershipsForGroup(tx, connectedGroupId, ctx.userID);
    }

    await reconcileMembershipDrivenEventsForGroups(
      tx,
      [args.id, ...affectedConnectedGroupIds],
      ctx.userID
    );

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

  // ── Relationship overrides (hierarchy propagation) ──────────────────

  createRelationship: defineMutator(createGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    if (args.with_right === 'passiveVotingRight' && args.status === 'active') {
      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'relationship_activation',
        draft_relationships: [
          {
            id: args.id,
            group_id: args.group_id,
            related_group_id: args.related_group_id,
            relationship_type: args.relationship_type,
            with_right: args.with_right,
            status: args.status,
            initiator_group_id: args.initiator_group_id,
          },
        ],
      });
    }

    await mutators.groups.createRelationship.fn({ tx, ctx, args });

    const affectedMembershipGroupIds = new Set<string>([args.group_id, args.related_group_id]);

    if (args.with_right === 'passiveVotingRight' && args.status === 'active') {
      const activatedGroupIds = await applyActivatedHierarchyRelationshipEffects(tx, ctx, args);
      for (const affectedGroupId of activatedGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }
    }

    await recomputeSiblingMembershipsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
  }),

  updateRelationship: defineMutator(updateGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    const relationship = await tx.run(zql.group_relationship.where('id', args.id).one());

    if (!relationship) {
      await mutators.groups.updateRelationship.fn({ tx, ctx, args });
      return;
    }

    const nextRelationship = {
      ...relationship,
      relationship_type:
        args.relationship_type !== undefined
          ? args.relationship_type
          : relationship.relationship_type,
      with_right: args.with_right !== undefined ? args.with_right : relationship.with_right,
      status: args.status !== undefined ? args.status : relationship.status,
    };
    const hadActivePvr =
      relationship.with_right === 'passiveVotingRight' &&
      isGraphActiveRelationshipStatus(relationship.status);
    const hasActivePvr =
      nextRelationship.with_right === 'passiveVotingRight' &&
      isGraphActiveRelationshipStatus(nextRelationship.status);
    const hierarchyStructureChanged =
      relationship.relationship_type !== nextRelationship.relationship_type;

    if (hasActivePvr && (!hadActivePvr || hierarchyStructureChanged)) {
      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'relationship_activation',
        draft_relationships: [
          {
            id: nextRelationship.id,
            group_id: nextRelationship.group_id,
            related_group_id: nextRelationship.related_group_id,
            relationship_type: nextRelationship.relationship_type,
            with_right: nextRelationship.with_right,
            status: nextRelationship.status,
            initiator_group_id: nextRelationship.initiator_group_id,
          },
        ],
      });
    }

    await mutators.groups.updateRelationship.fn({ tx, ctx, args });

    const affectedMembershipGroupIds = new Set<string>([
      relationship.group_id,
      relationship.related_group_id,
    ]);

    if (hadActivePvr && (!hasActivePvr || hierarchyStructureChanged)) {
      const deletedGroupIds = await applyDeletedHierarchyRelationshipEffects(tx, ctx, relationship);
      for (const affectedGroupId of deletedGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }
    }

    if (hasActivePvr && (!hadActivePvr || hierarchyStructureChanged)) {
      const activatedGroupIds = await applyActivatedHierarchyRelationshipEffects(
        tx,
        ctx,
        nextRelationship
      );
      for (const affectedGroupId of activatedGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }
    }

    await recomputeSiblingMembershipsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
  }),

  deleteRelationship: defineMutator(deleteGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    const relationship = await tx.run(zql.group_relationship.where('id', args.id).one());

    await mutators.groups.deleteRelationship.fn({ tx, ctx, args });

    if (!relationship) {
      return;
    }

    const affectedMembershipGroupIds = new Set<string>([
      relationship.group_id,
      relationship.related_group_id,
    ]);

    if (
      relationship.with_right === 'passiveVotingRight' &&
      isGraphActiveRelationshipStatus(relationship.status)
    ) {
      const deletedGroupIds = await applyDeletedHierarchyRelationshipEffects(tx, ctx, relationship);
      for (const affectedGroupId of deletedGroupIds) {
        affectedMembershipGroupIds.add(affectedGroupId);
      }
    }

    await recomputeSiblingMembershipsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
    await reconcileMembershipDrivenEventsForGroups(tx, affectedMembershipGroupIds, ctx.userID);
  }),
};
