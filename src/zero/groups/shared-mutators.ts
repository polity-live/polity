import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { isPermissionError } from '../rbac/errors';
import { zql } from '../schema';
import {
  groupCreateSchema,
  groupUpdateSchema,
  groupDeleteSchema,
  groupMembershipCreateSchema,
  groupMembershipLegacyRoleUpdateSchema,
  groupMembershipDeleteSchema,
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
  groupGuestAccessCreateSchema,
  groupGuestAccessAcceptSchema,
  groupGuestAccessDeleteSchema,
  groupGuestRoleAssignSchema,
  groupGuestRoleUnassignSchema,
  groupGuestRolesSyncSchema,
  roleCreateSchema,
  roleUpdateSchema,
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
import { z } from 'zod';
import {
  assertValidSiblingConfiguration,
  isManualGroupMembershipSource,
  syncSiblingSourceGroups,
  userHasActiveMembershipInGroup,
} from './membership-helpers';
import { ensureOfflineDirectMembership } from './offline-membership-helpers';

async function authorizeScopedRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  scope: {
    group_id?: string | null;
    event_id?: string | null;
    blog_id?: string | null;
  }
) {
  if (scope.group_id) {
    await can(tx, ctx, { action: 'manage', resource: 'groupAccessRoles', groupId: scope.group_id });
    return;
  }

  if (scope.event_id) {
    await can(tx, ctx, { action: 'manage', resource: 'events', eventId: scope.event_id });
    return;
  }

  if (scope.blog_id) {
    await can(tx, ctx, { action: 'manage', resource: 'blogs', blogId: scope.blog_id });
  }
}

async function loadMembershipForRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupMembershipId: string
) {
  const membership = await tx.run(zql.group_membership.where('id', groupMembershipId).one());
  if (!membership) {
    throw new Error('Membership not found');
  }

  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupMemberships',
    groupId: membership.group_id,
  });

  return membership;
}

async function loadOfflineMembershipForRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupOfflineMembershipId: string
) {
  const membership = await tx.run(
    zql.group_offline_membership.where('id', groupOfflineMembershipId).one()
  );
  if (!membership) {
    throw new Error('Offline membership not found');
  }

  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupMemberships',
    groupId: membership.group_id,
  });

  return membership;
}

async function loadGuestAccessForRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupGuestAccessId: string
) {
  const guestAccess = await tx.run(zql.group_guest_access.where('id', groupGuestAccessId).one());
  if (!guestAccess) {
    throw new Error('Guest access not found');
  }

  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupMemberships',
    groupId: guestAccess.group_id,
  });

  return guestAccess;
}

async function loadRole(tx: Parameters<typeof can>[0], roleId: string) {
  const role = await tx.run(zql.role.where('id', roleId).one());
  if (!role) {
    throw new Error('Role not found');
  }
  return role;
}

async function assertRolesAssignableToMembers(
  tx: Parameters<typeof can>[0],
  roleIds: readonly string[],
  groupId?: string
) {
  for (const roleId of [...new Set(roleIds.filter(Boolean))]) {
    const role = await loadRole(tx, roleId);
    if (role.assignee_kind === 'guest') {
      throw new Error('Guest roles cannot be assigned to official group memberships.');
    }
    if (groupId && (role.group_id !== groupId || role.scope !== 'group')) {
      throw new Error('Membership roles must belong to the target group.');
    }
  }
}

async function assertRolesAssignableToGuests(
  tx: Parameters<typeof can>[0],
  groupId: string,
  roleIds: readonly string[]
) {
  for (const roleId of [...new Set(roleIds.filter(Boolean))]) {
    const role = await loadRole(tx, roleId);
    if (role.group_id !== groupId || role.scope !== 'group') {
      throw new Error('Guest roles must belong to the target group.');
    }
    if (role.assignee_kind !== 'guest') {
      throw new Error('Only guest roles can be assigned to guests.');
    }
  }
}

async function assertCanDirectlyMutateOfficialMembership(
  tx: Parameters<typeof can>[0],
  groupId: string,
  userId: string
) {
  const group = await tx.run(zql.group.where('id', groupId).one());
  if (!group) {
    throw new Error('Group not found');
  }

  if (group.group_type === 'hierarchical') {
    throw new Error('Cannot directly manage memberships in hierarchical groups.');
  }

  if (group.group_type === 'sibling') {
    if (group.sibling_membership_mode !== 'open' || !group.connected_group_id) {
      throw new Error('Only open sibling groups allow direct memberships.');
    }

    const isEligible = await userHasActiveMembershipInGroup(tx, userId, group.connected_group_id);
    if (!isEligible) {
      throw new Error('Only active members of the connected group can join this sibling group.');
    }
  }

  return group;
}

async function addGroupMembershipRole(
  tx: Parameters<typeof can>[0],
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

async function removeGroupMembershipRole(
  tx: Parameters<typeof can>[0],
  args: {
    group_membership_id: string;
    role_id: string;
  }
) {
  const existingLinks = await tx.run(
    zql.group_membership_role
      .where('group_membership_id', args.group_membership_id)
      .where('role_id', args.role_id)
  );

  for (const link of existingLinks) {
    await tx.mutate.group_membership_role.delete({ id: link.id });
  }
}

async function syncGroupMembershipRoles(
  tx: Parameters<typeof can>[0],
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
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));
  const desiredRoleIdSet = new Set(desiredRoleIds);

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.group_membership_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addGroupMembershipRole(tx, {
        group_membership_id: args.group_membership_id,
        role_id: roleId,
        assigned_by_id: args.assigned_by_id,
      });
    }
  }
}

async function addGroupOfflineMembershipRole(
  tx: Parameters<typeof can>[0],
  args: {
    group_offline_membership_id: string;
    role_id: string;
    assigned_by_id?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.group_offline_membership_role
      .where('group_offline_membership_id', args.group_offline_membership_id)
      .where('role_id', args.role_id)
      .one()
  );

  if (existingLink) {
    return existingLink.id;
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  await tx.mutate.group_offline_membership_role.insert({
    id,
    group_offline_membership_id: args.group_offline_membership_id,
    role_id: args.role_id,
    assigned_at: now,
    assigned_by_id: args.assigned_by_id ?? null,
    created_at: now,
  });

  return id;
}

async function removeGroupOfflineMembershipRole(
  tx: Parameters<typeof can>[0],
  args: {
    group_offline_membership_id: string;
    role_id: string;
  }
) {
  const existingLinks = await tx.run(
    zql.group_offline_membership_role
      .where('group_offline_membership_id', args.group_offline_membership_id)
      .where('role_id', args.role_id)
  );

  for (const link of existingLinks) {
    await tx.mutate.group_offline_membership_role.delete({ id: link.id });
  }
}

async function syncGroupOfflineMembershipRoles(
  tx: Parameters<typeof can>[0],
  args: {
    group_offline_membership_id: string;
    role_ids: string[];
    assigned_by_id?: string | null;
  }
) {
  const desiredRoleIds = [...new Set(args.role_ids.filter(Boolean))];
  const existingLinks = await tx.run(
    zql.group_offline_membership_role.where(
      'group_offline_membership_id',
      args.group_offline_membership_id
    )
  );
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));
  const desiredRoleIdSet = new Set(desiredRoleIds);

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.group_offline_membership_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addGroupOfflineMembershipRole(tx, {
        group_offline_membership_id: args.group_offline_membership_id,
        role_id: roleId,
        assigned_by_id: args.assigned_by_id,
      });
    }
  }
}

async function addGroupGuestRole(
  tx: Parameters<typeof can>[0],
  args: {
    group_guest_access_id: string;
    role_id: string;
    assigned_by_id?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.group_guest_role
      .where('group_guest_access_id', args.group_guest_access_id)
      .where('role_id', args.role_id)
      .one()
  );

  if (existingLink) {
    return existingLink.id;
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  await tx.mutate.group_guest_role.insert({
    id,
    group_guest_access_id: args.group_guest_access_id,
    role_id: args.role_id,
    assigned_at: now,
    assigned_by_id: args.assigned_by_id ?? null,
    created_at: now,
  });

  return id;
}

async function removeGroupGuestRole(
  tx: Parameters<typeof can>[0],
  args: {
    group_guest_access_id: string;
    role_id: string;
  }
) {
  const existingLinks = await tx.run(
    zql.group_guest_role
      .where('group_guest_access_id', args.group_guest_access_id)
      .where('role_id', args.role_id)
  );

  for (const link of existingLinks) {
    await tx.mutate.group_guest_role.delete({ id: link.id });
  }
}

async function syncGroupGuestRoles(
  tx: Parameters<typeof can>[0],
  args: {
    group_guest_access_id: string;
    role_ids: string[];
    assigned_by_id?: string | null;
  }
) {
  const desiredRoleIds = [...new Set(args.role_ids.filter(Boolean))];
  const existingLinks = await tx.run(
    zql.group_guest_role.where('group_guest_access_id', args.group_guest_access_id)
  );
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));
  const desiredRoleIdSet = new Set(desiredRoleIds);

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.group_guest_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addGroupGuestRole(tx, {
        group_guest_access_id: args.group_guest_access_id,
        role_id: roleId,
        assigned_by_id: args.assigned_by_id,
      });
    }
  }
}

async function resolveDefaultMembershipRoleId(
  tx: Parameters<typeof can>[0],
  groupId: string,
  status: string | null | undefined,
  explicitRoleId?: string | null
) {
  if (explicitRoleId) {
    return explicitRoleId;
  }

  if (status !== 'requested' && status !== 'invited') {
    return null;
  }

  const roles = await tx.run(
    zql.role.where('group_id', groupId).where('scope', 'group').orderBy('sort_order', 'asc')
  );
  const memberRoles = roles.filter(role => role.assignee_kind !== 'guest');

  if (status === 'requested') {
    const configuredRole = memberRoles.find(role => role.default_request_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  if (status === 'invited') {
    const configuredRole = memberRoles.find(role => role.default_invite_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  return memberRoles.find(role => role.name === 'Member')?.id ?? null;
}

async function assignDefaultInviteRoleToOfflineMembership(
  tx: Parameters<typeof can>[0],
  args: {
    groupId: string;
    groupOfflineMembershipId: string;
    assignedById?: string | null;
  }
) {
  const initialRoleId = await resolveDefaultMembershipRoleId(tx, args.groupId, 'invited');

  if (!initialRoleId) {
    return;
  }

  await syncGroupOfflineMembershipRoles(tx, {
    group_offline_membership_id: args.groupOfflineMembershipId,
    role_ids: [initialRoleId],
    assigned_by_id: args.assignedById,
  });
}

async function clearGroupRoleDefaults(
  tx: Parameters<typeof can>[0],
  args: {
    groupId: string;
    keepRoleId?: string;
    clearRequestDefault?: boolean;
    clearInviteDefault?: boolean;
  }
) {
  if (!args.clearRequestDefault && !args.clearInviteDefault) {
    return;
  }

  const groupRoles = await tx.run(zql.role.where('group_id', args.groupId).where('scope', 'group'));

  for (const role of groupRoles) {
    if (args.keepRoleId && role.id === args.keepRoleId) {
      continue;
    }

    const patch: {
      id: string;
      default_request_role?: boolean;
      default_invite_role?: boolean;
    } = { id: role.id };

    if (args.clearRequestDefault && role.default_request_role) {
      patch.default_request_role = false;
    }

    if (args.clearInviteDefault && role.default_invite_role) {
      patch.default_invite_role = false;
    }

    if (patch.default_request_role !== undefined || patch.default_invite_role !== undefined) {
      await tx.mutate.role.update(patch);
    }
  }
}

async function authorizeGroupRelationshipEndpointMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  relationship: {
    group_id: string;
    related_group_id: string;
  }
) {
  const endpointGroupIds = [...new Set([relationship.group_id, relationship.related_group_id])];
  let lastPermissionError: unknown = null;

  for (const endpointGroupId of endpointGroupIds) {
    try {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupRelationships',
        groupId: endpointGroupId,
      });
      return;
    } catch (error) {
      if (!isPermissionError(error)) {
        throw error;
      }

      lastPermissionError = error;
    }
  }

  if (lastPermissionError) {
    throw lastPermissionError;
  }

  throw new Error('Relationship must reference at least one group.');
}

function normalizeOptionalReason(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeRequiredName(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('First name and last name are required.');
  }

  return trimmedValue;
}

async function assertCanManageGroupOfflineMembers(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupId: string
) {
  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupMemberships',
    groupId,
  });

  const group = await tx.run(zql.group.where('id', groupId).one());
  if (!group) {
    throw new Error('Group not found');
  }

  if (group.group_type !== 'base') {
    throw new Error('Offline members can only be managed directly on base groups.');
  }

  return group;
}

async function loadGroupOfflineMemberForMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  offlineMemberId: string
) {
  const offlineMember = await tx.run(zql.group_offline_member.where('id', offlineMemberId).one());
  if (!offlineMember) {
    throw new Error('Offline member not found');
  }

  await assertCanManageGroupOfflineMembers(tx, ctx, offlineMember.group_id);
  return offlineMember;
}

async function assertUniqueConnectedOfflineUserWithinGroup(
  tx: Parameters<typeof can>[0],
  args: {
    groupId: string;
    connectedUserId?: string | null;
    excludeOfflineMemberId?: string;
  }
) {
  if (!args.connectedUserId) {
    return;
  }

  const existingOfflineMembers = await tx.run(
    zql.group_offline_member
      .where('group_id', args.groupId)
      .where('connected_user_id', args.connectedUserId)
  );

  const hasConflict = existingOfflineMembers.some(
    offlineMember => offlineMember.id !== args.excludeOfflineMemberId
  );
  if (hasConflict) {
    throw new Error(
      'This active user is already connected to another offline member of the group.'
    );
  }
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const groupSharedMutators = {
  create: defineMutator(groupCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    const { parliament_source_group_ids, ...groupArgs } = args;

    await assertValidSiblingConfiguration(tx, {
      groupId: args.id,
      groupType: groupArgs.group_type,
      connectedGroupId: groupArgs.connected_group_id,
      siblingMembershipMode: groupArgs.sibling_membership_mode,
      siblingRoleId: groupArgs.sibling_role_id,
      parliamentSourceGroupIds: parliament_source_group_ids,
    });

    if (
      groupArgs.group_type === 'sibling' &&
      groupArgs.sibling_membership_mode === 'open' &&
      groupArgs.connected_group_id
    ) {
      const creatorIsEligible = await userHasActiveMembershipInGroup(
        tx,
        userID,
        groupArgs.connected_group_id
      );
      if (!creatorIsEligible) {
        throw new Error(
          'Only active members of the connected group can create open sibling groups with official memberships.'
        );
      }
    }

    const initialMemberCount =
      groupArgs.group_type === 'sibling' && groupArgs.sibling_membership_mode !== 'open' ? 0 : 1;

    await tx.mutate.group.insert({
      ...groupArgs,
      owner_id: userID,
      member_count: initialMemberCount,
      subscriber_count: 0,
      event_count: 0,
      amendment_count: 0,
      document_count: 0,
      created_at: now,
      updated_at: now,
    });

    await syncSiblingSourceGroups(
      tx,
      args.id,
      groupArgs.group_type === 'sibling' && groupArgs.sibling_membership_mode === 'parliament'
        ? (parliament_source_group_ids ?? [])
        : []
    );
  }),

  update: defineMutator(groupUpdateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.id });
    const existingGroup = await tx.run(zql.group.where('id', args.id).one());
    if (!existingGroup) {
      throw new Error('Group not found');
    }

    const { parliament_source_group_ids, ...groupArgs } = args;
    const nextGroupType = groupArgs.group_type ?? existingGroup.group_type;
    const nextConnectedGroupId =
      groupArgs.connected_group_id !== undefined
        ? groupArgs.connected_group_id
        : existingGroup.connected_group_id;
    const nextSiblingMembershipMode =
      groupArgs.sibling_membership_mode !== undefined
        ? groupArgs.sibling_membership_mode
        : existingGroup.sibling_membership_mode;
    const nextSiblingRoleId =
      groupArgs.sibling_role_id !== undefined
        ? groupArgs.sibling_role_id
        : existingGroup.sibling_role_id;
    const nextSourceGroupIds =
      parliament_source_group_ids ??
      (await tx.run(zql.group_sibling_source.where('group_id', args.id))).map(
        sourceLink => sourceLink.source_group_id
      );

    await assertValidSiblingConfiguration(tx, {
      groupId: args.id,
      groupType: nextGroupType,
      connectedGroupId: nextConnectedGroupId,
      siblingMembershipMode: nextSiblingMembershipMode,
      siblingRoleId: nextSiblingRoleId,
      parliamentSourceGroupIds: nextSourceGroupIds,
    });

    await tx.mutate.group.update({ ...groupArgs, updated_at: Date.now() });
    await syncSiblingSourceGroups(
      tx,
      args.id,
      nextGroupType === 'sibling' && nextSiblingMembershipMode === 'parliament'
        ? nextSourceGroupIds
        : []
    );
  }),

  delete: defineMutator(groupDeleteSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.id });
    await tx.mutate.group.delete({ id: args.id });
  }),

  createOfflineMember: defineMutator(groupOfflineMemberCreateSchema, async ({ tx, ctx, args }) => {
    const group = await assertCanManageGroupOfflineMembers(tx, ctx, args.group_id);
    void group;
    await assertUniqueConnectedOfflineUserWithinGroup(tx, {
      groupId: args.group_id,
      connectedUserId: args.connected_user_id ?? null,
    });

    const now = Date.now();
    await tx.mutate.group_offline_member.insert({
      id: args.id,
      group_id: args.group_id,
      first_name: normalizeRequiredName(args.first_name),
      last_name: normalizeRequiredName(args.last_name),
      reason_not_signed_up: normalizeOptionalReason(args.reason_not_signed_up),
      connected_user_id: args.connected_user_id ?? null,
      created_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });

    const offlineMembershipId = await ensureOfflineDirectMembership(tx, {
      groupId: args.group_id,
      groupOfflineMemberId: args.id,
    });
    await assignDefaultInviteRoleToOfflineMembership(tx, {
      groupId: args.group_id,
      groupOfflineMembershipId: offlineMembershipId,
      assignedById: ctx.userID,
    });
  }),

  updateOfflineMember: defineMutator(groupOfflineMemberUpdateSchema, async ({ tx, ctx, args }) => {
    const offlineMember = await loadGroupOfflineMemberForMutation(tx, ctx, args.id);
    const connectedUserId =
      args.connected_user_id !== undefined
        ? args.connected_user_id
        : offlineMember.connected_user_id;
    await assertUniqueConnectedOfflineUserWithinGroup(tx, {
      groupId: offlineMember.group_id,
      connectedUserId,
      excludeOfflineMemberId: offlineMember.id,
    });

    await tx.mutate.group_offline_member.update({
      id: args.id,
      ...(args.first_name !== undefined
        ? { first_name: normalizeRequiredName(args.first_name) }
        : {}),
      ...(args.last_name !== undefined ? { last_name: normalizeRequiredName(args.last_name) } : {}),
      ...(args.reason_not_signed_up !== undefined
        ? { reason_not_signed_up: normalizeOptionalReason(args.reason_not_signed_up) }
        : {}),
      ...(args.connected_user_id !== undefined
        ? { connected_user_id: args.connected_user_id ?? null }
        : {}),
      updated_at: Date.now(),
    });
  }),

  deleteOfflineMember: defineMutator(groupOfflineMemberDeleteSchema, async ({ tx, ctx, args }) => {
    await loadGroupOfflineMemberForMutation(tx, ctx, args.id);
    await tx.mutate.group_offline_member.delete({ id: args.id });
  }),

  importOfflineMembers: defineMutator(
    groupOfflineMemberBulkImportSchema,
    async ({ tx, ctx, args }) => {
      await assertCanManageGroupOfflineMembers(tx, ctx, args.group_id);

      const existingOfflineMembers = await tx.run(
        zql.group_offline_member.where('group_id', args.group_id)
      );
      const existingKeys = new Set(
        existingOfflineMembers.map(offlineMember =>
          [
            offlineMember.first_name.trim().toLowerCase(),
            offlineMember.last_name.trim().toLowerCase(),
            (offlineMember.reason_not_signed_up ?? '').trim().toLowerCase(),
          ].join('|')
        )
      );
      const seenImportKeys = new Set<string>();
      const now = Date.now();

      for (const entry of args.entries) {
        const firstName = normalizeRequiredName(entry.first_name);
        const lastName = normalizeRequiredName(entry.last_name);
        const reasonNotSignedUp = normalizeOptionalReason(entry.reason_not_signed_up);
        const dedupeKey = [
          firstName.toLowerCase(),
          lastName.toLowerCase(),
          (reasonNotSignedUp ?? '').toLowerCase(),
        ].join('|');
        if (existingKeys.has(dedupeKey) || seenImportKeys.has(dedupeKey)) {
          continue;
        }

        seenImportKeys.add(dedupeKey);
        const offlineMemberId = crypto.randomUUID();
        await tx.mutate.group_offline_member.insert({
          id: offlineMemberId,
          group_id: args.group_id,
          first_name: firstName,
          last_name: lastName,
          reason_not_signed_up: reasonNotSignedUp,
          connected_user_id: null,
          created_by_id: ctx.userID,
          created_at: now,
          updated_at: now,
        });

        const offlineMembershipId = await ensureOfflineDirectMembership(tx, {
          groupId: args.group_id,
          groupOfflineMemberId: offlineMemberId,
        });
        await assignDefaultInviteRoleToOfflineMembership(tx, {
          groupId: args.group_id,
          groupOfflineMembershipId: offlineMembershipId,
          assignedById: ctx.userID,
        });
      }
    }
  ),

  joinGroup: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    await assertCanDirectlyMutateOfficialMembership(tx, args.group_id, userID);

    const now = Date.now();
    const { initial_role_id, ...membershipArgs } = args;
    if (initial_role_id) {
      await assertRolesAssignableToMembers(tx, [initial_role_id], args.group_id);
    }
    await tx.mutate.group_membership.insert({
      ...membershipArgs,
      user_id: userID,
      source: 'direct',
      source_group_id: null,
      created_at: now,
    });

    const initialRoleId = await resolveDefaultMembershipRoleId(
      tx,
      args.group_id,
      args.status,
      initial_role_id
    );

    if (initialRoleId) {
      await syncGroupMembershipRoles(tx, {
        group_membership_id: args.id,
        role_ids: [initialRoleId],
        assigned_by_id: userID,
      });
    }
  }),

  leaveGroup: defineMutator(groupMembershipDeleteSchema, async ({ tx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (membership && !isManualGroupMembershipSource(membership.source)) {
      throw new Error('Only direct memberships can be changed manually.');
    }
    await tx.mutate.group_membership.delete({ id: args.id });
  }),

  inviteMember: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groupMemberships', groupId: args.group_id });
    if (!args.user_id) throw new Error('user_id is required for inviteMember');

    await assertCanDirectlyMutateOfficialMembership(tx, args.group_id, args.user_id);

    const now = Date.now();
    const { initial_role_id, ...membershipArgs } = args;
    if (initial_role_id) {
      await assertRolesAssignableToMembers(tx, [initial_role_id], args.group_id);
    }
    await tx.mutate.group_membership.insert({
      ...membershipArgs,
      user_id: args.user_id,
      status: 'invited',
      source: 'direct',
      source_group_id: null,
      created_at: now,
    });

    const initialRoleId = await resolveDefaultMembershipRoleId(
      tx,
      args.group_id,
      'invited',
      initial_role_id
    );

    if (initialRoleId) {
      await syncGroupMembershipRoles(tx, {
        group_membership_id: args.id,
        role_ids: [initialRoleId],
        assigned_by_id: ctx.userID,
      });
    }
  }),

  acceptInvitation: defineMutator(z.object({ id: z.string() }), async ({ tx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (!membership) {
      throw new Error('Membership not found');
    }
    if (!isManualGroupMembershipSource(membership.source)) {
      throw new Error('Automatic memberships cannot be accepted manually.');
    }
    await tx.mutate.group_membership.update({ id: args.id, status: 'active' });
  }),

  addMembershipRole: defineMutator(groupMembershipRoleAssignSchema, async ({ tx, ctx, args }) => {
    const membership = await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
    await assertRolesAssignableToMembers(tx, [args.role_id], membership.group_id);
    await addGroupMembershipRole(tx, args);
  }),

  removeMembershipRole: defineMutator(
    groupMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
      await removeGroupMembershipRole(tx, args);
    }
  ),

  syncMembershipRoles: defineMutator(groupMembershipRolesSyncSchema, async ({ tx, ctx, args }) => {
    const membership = await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
    await assertRolesAssignableToMembers(tx, args.role_ids, membership.group_id);
    await syncGroupMembershipRoles(tx, args);
  }),

  addOfflineMembershipRole: defineMutator(
    groupOfflineMembershipRoleAssignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await loadOfflineMembershipForRoleMutation(
        tx,
        ctx,
        args.group_offline_membership_id
      );
      await assertRolesAssignableToMembers(tx, [args.role_id], membership.group_id);
      await addGroupOfflineMembershipRole(tx, args);
    }
  ),

  removeOfflineMembershipRole: defineMutator(
    groupOfflineMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      await loadOfflineMembershipForRoleMutation(tx, ctx, args.group_offline_membership_id);
      await removeGroupOfflineMembershipRole(tx, args);
    }
  ),

  syncOfflineMembershipRoles: defineMutator(
    groupOfflineMembershipRolesSyncSchema,
    async ({ tx, ctx, args }) => {
      const membership = await loadOfflineMembershipForRoleMutation(
        tx,
        ctx,
        args.group_offline_membership_id
      );
      await assertRolesAssignableToMembers(tx, args.role_ids, membership.group_id);
      await syncGroupOfflineMembershipRoles(tx, args);
    }
  ),

  updateMemberRole: defineMutator(
    groupMembershipLegacyRoleUpdateSchema,
    async ({ tx, ctx, args }) => {
      const { role_id, ...membershipArgs } = args;

      if (Object.keys(membershipArgs).length > 1) {
        await tx.mutate.group_membership.update(membershipArgs);
      }

      if (role_id !== undefined) {
        const membership = await loadMembershipForRoleMutation(tx, ctx, args.id);
        await assertRolesAssignableToMembers(tx, role_id ? [role_id] : [], membership.group_id);
        await syncGroupMembershipRoles(tx, {
          group_membership_id: args.id,
          role_ids: role_id ? [role_id] : [],
          assigned_by_id: ctx.userID,
        });
      }
    }
  ),

  inviteGuest: defineMutator(groupGuestAccessCreateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groupMemberships', groupId: args.group_id });

    const desiredRoleIds = [...new Set((args.role_ids ?? []).filter(Boolean))];
    if (desiredRoleIds.length === 0) {
      throw new Error('Guests must always be invited with at least one guest role.');
    }

    await assertRolesAssignableToGuests(tx, args.group_id, desiredRoleIds);

    const existingGuestAccess = await tx.run(
      zql.group_guest_access.where('group_id', args.group_id).where('user_id', args.user_id).one()
    );

    if (existingGuestAccess) {
      await tx.mutate.group_guest_access.update({
        id: existingGuestAccess.id,
        status: 'invited',
        invited_by_id: ctx.userID,
        updated_at: Date.now(),
      });

      await syncGroupGuestRoles(tx, {
        group_guest_access_id: existingGuestAccess.id,
        role_ids: desiredRoleIds,
        assigned_by_id: ctx.userID,
      });
      return;
    }

    const now = Date.now();
    await tx.mutate.group_guest_access.insert({
      id: args.id,
      group_id: args.group_id,
      user_id: args.user_id,
      status: args.status,
      invited_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });

    await syncGroupGuestRoles(tx, {
      group_guest_access_id: args.id,
      role_ids: desiredRoleIds,
      assigned_by_id: ctx.userID,
    });
  }),

  acceptGuestInvitation: defineMutator(groupGuestAccessAcceptSchema, async ({ tx, args }) => {
    await tx.mutate.group_guest_access.update({
      id: args.id,
      status: 'active',
      updated_at: Date.now(),
    });
  }),

  revokeGuestAccess: defineMutator(groupGuestAccessDeleteSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await loadGuestAccessForRoleMutation(tx, ctx, args.id);
    await tx.mutate.group_guest_access.update({
      id: guestAccess.id,
      status: 'revoked',
      updated_at: Date.now(),
    });
  }),

  addGuestRole: defineMutator(groupGuestRoleAssignSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await loadGuestAccessForRoleMutation(tx, ctx, args.group_guest_access_id);
    await assertRolesAssignableToGuests(tx, guestAccess.group_id, [args.role_id]);
    await addGroupGuestRole(tx, args);
  }),

  removeGuestRole: defineMutator(groupGuestRoleUnassignSchema, async ({ tx, ctx, args }) => {
    await loadGuestAccessForRoleMutation(tx, ctx, args.group_guest_access_id);
    await removeGroupGuestRole(tx, args);
  }),

  syncGuestRoles: defineMutator(groupGuestRolesSyncSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await loadGuestAccessForRoleMutation(tx, ctx, args.group_guest_access_id);
    if (args.role_ids.length === 0) {
      throw new Error('Guests must keep at least one guest role.');
    }
    await assertRolesAssignableToGuests(tx, guestAccess.group_id, args.role_ids);
    await syncGroupGuestRoles(tx, args);
  }),

  createRole: defineMutator(roleCreateSchema, async ({ tx, ctx, args }) => {
    await authorizeScopedRoleMutation(tx, ctx, args);
    const assigneeKind = args.assignee_kind ?? 'member';
    if (assigneeKind === 'guest' && (args.default_request_role || args.default_invite_role)) {
      throw new Error('Guest roles cannot be used as default membership request or invite roles.');
    }
    if (args.group_id) {
      await clearGroupRoleDefaults(tx, {
        groupId: args.group_id,
        clearRequestDefault: assigneeKind !== 'guest' && Boolean(args.default_request_role),
        clearInviteDefault: assigneeKind !== 'guest' && Boolean(args.default_invite_role),
      });
    }
    const now = Date.now();
    await tx.mutate.role.insert({
      ...args,
      assignment_mode: args.assignment_mode ?? 'assigned',
      visibility: args.visibility ?? 'public',
      term_start_date: args.term_start_date ?? null,
      is_recurring: args.is_recurring ?? false,
      recurrence_pattern: args.recurrence_pattern ?? null,
      recurrence_rule: args.recurrence_rule ?? null,
      recurrence_interval: args.recurrence_interval ?? null,
      recurrence_days: args.recurrence_days ?? null,
      recurrence_end_date: args.recurrence_end_date ?? null,
      scheduled_revote_date: args.scheduled_revote_date ?? null,
      default_request_role: args.default_request_role ?? false,
      default_invite_role: args.default_invite_role ?? false,
      assignee_kind: assigneeKind,
      sort_order: args.sort_order ?? 0,
      created_at: now,
    });
  }),

  updateRole: defineMutator(roleUpdateSchema, async ({ tx, ctx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role) {
      await authorizeScopedRoleMutation(tx, ctx, role);
      const nextAssigneeKind = args.assignee_kind ?? role.assignee_kind;
      const nextDefaultRequestRole = args.default_request_role ?? role.default_request_role;
      const nextDefaultInviteRole = args.default_invite_role ?? role.default_invite_role;
      if (nextAssigneeKind === 'guest' && (nextDefaultRequestRole || nextDefaultInviteRole)) {
        throw new Error(
          'Guest roles cannot be used as default membership request or invite roles.'
        );
      }
      if (role.group_id) {
        await clearGroupRoleDefaults(tx, {
          groupId: role.group_id,
          keepRoleId: role.id,
          clearRequestDefault: nextAssigneeKind !== 'guest' && args.default_request_role === true,
          clearInviteDefault: nextAssigneeKind !== 'guest' && args.default_invite_role === true,
        });
      }
    }
    await tx.mutate.role.update(args);
  }),

  deleteRole: defineMutator(roleDeleteSchema, async ({ tx, ctx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role) {
      await authorizeScopedRoleMutation(tx, ctx, role);
    }
    await tx.mutate.role.delete({ id: args.id });
  }),

  assignActionRight: defineMutator(actionRightCreateSchema, async ({ tx, ctx, args }) => {
    await authorizeScopedRoleMutation(tx, ctx, args);
    const role = await tx.run(zql.role.where('id', args.role_id).one());
    if (
      role?.event_id &&
      role.assignee_kind === 'guest' &&
      args.resource === 'events' &&
      (args.action === 'active_voting' || args.action === 'passive_voting')
    ) {
      throw new Error('Guest event roles cannot receive active or passive voting rights.');
    }
    const now = Date.now();
    await tx.mutate.action_right.insert({ ...args, created_at: now });
  }),

  removeActionRight: defineMutator(actionRightDeleteSchema, async ({ tx, ctx, args }) => {
    const actionRight = await tx.run(zql.action_right.where('id', args.id).one());
    if (actionRight) {
      await authorizeScopedRoleMutation(tx, ctx, actionRight);
    }
    await tx.mutate.action_right.delete({ id: args.id });
  }),

  // Group Relationship mutators
  createRelationship: defineMutator(createGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    if (!args.initiator_group_id) {
      throw new Error('initiator_group_id is required');
    }

    if (
      args.initiator_group_id !== args.group_id &&
      args.initiator_group_id !== args.related_group_id
    ) {
      throw new Error('initiator_group_id must match group_id or related_group_id');
    }

    if (tx.location !== 'client') {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupRelationships',
        groupId: args.initiator_group_id,
      });
    }

    const now = Date.now();
    await tx.mutate.group_relationship.insert({ ...args, created_at: now });
  }),

  updateRelationship: defineMutator(updateGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const relationship = await tx.run(zql.group_relationship.where('id', args.id).one());
      if (!relationship) {
        throw new Error('Relationship not found');
      }

      await authorizeGroupRelationshipEndpointMutation(tx, ctx, relationship);
    }

    await tx.mutate.group_relationship.update(args);
  }),

  deleteRelationship: defineMutator(deleteGroupRelationshipSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const relationship = await tx.run(zql.group_relationship.where('id', args.id).one());
      if (!relationship) {
        throw new Error('Relationship not found');
      }

      await authorizeGroupRelationshipEndpointMutation(tx, ctx, relationship);
    }

    await tx.mutate.group_relationship.delete({ id: args.id });
  }),

  // Role holder history mutators
  createRoleHolderHistory: defineMutator(roleHolderHistoryCreateSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.role_holder_history.insert({
      ...args,
      created_at: now,
    });
  }),

  updateRoleHolderHistory: defineMutator(roleHolderHistoryUpdateSchema, async ({ tx, args }) => {
    await tx.mutate.role_holder_history.update(args);
  }),
};
