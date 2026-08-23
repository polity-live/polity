import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated } from '../rbac/authorize';
import { AMENDMENT_ACTION_RIGHTS, DEFAULT_GROUP_ROLES } from '../rbac/constants';
import { creatorActionRightId, creatorRbacId, creatorRoleId } from '../rbac/creator-bootstrap';
import { zql } from '../schema';
import {
  groupCreateSchema,
  groupFullCreateMutatorSchema,
  groupUpdateSchema,
  groupDeleteSchema,
  groupMembershipCreateSchema,
  groupMembershipUpdateSchema,
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
import { appendEntityActivity, buildActivityChanges, severityForChanges } from '../activity/shared';

const GROUP_ACTIVITY_FIELDS = [
  'name',
  'description',
  'email',
  'country',
  'region',
  'post_code',
  'city',
  'street',
  'house_number',
  'latitude',
  'longitude',
  'location_kind',
  'location_place_id',
  'location_boundary_source',
  'location_geometry',
  'location_bounds',
  'image_url',
  'video_url',
  'group_type',
  'has_hierarchy_children',
  'has_sibling_connections',
  'connected_group_id',
  'primary_sibling_membership_mode',
  'sibling_membership_mode',
  'sibling_role_id',
  'x',
  'youtube',
  'linkedin',
  'website',
  'whatsapp',
  'instagram',
  'twitter',
  'facebook',
  'snapchat',
  'tiktok',
  'visibility',
] as const;
const HIGH_GROUP_FIELDS = new Set<string>([
  'group_type',
  'has_hierarchy_children',
  'has_sibling_connections',
  'connected_group_id',
  'primary_sibling_membership_mode',
  'sibling_membership_mode',
  'sibling_role_id',
]);
import { z } from 'zod';
import {
  isManualGroupMembershipSource,
  loadGroupWithDerivedNetworkMeta,
  userHasActiveMembershipInGroup,
} from './membership-helpers';
import { ensureOfflineDirectMembership } from './offline-membership-helpers';

const GUEST_ONLY_SIBLING_MEMBERSHIP_MODES: ReadonlySet<string> = new Set([
  'all_members',
  'role_members',
  'selected_source_groups',
]);
const AMENDMENT_ACTION_RIGHT_KEYS = new Set(
  AMENDMENT_ACTION_RIGHTS.map(right => `${right.resource}:${right.action}`)
);

function isAllowedAmendmentActionRight(
  resource: string | null | undefined,
  action: string | null | undefined
) {
  return Boolean(resource && action && AMENDMENT_ACTION_RIGHT_KEYS.has(`${resource}:${action}`));
}

function requiresGuestAccessFlow(group: {
  group_type?: string | null;
  primary_sibling_membership_mode?: string | null;
}) {
  const primarySiblingMembershipMode = group.primary_sibling_membership_mode;
  return (
    group.group_type === 'sibling' &&
    typeof primarySiblingMembershipMode === 'string' &&
    GUEST_ONLY_SIBLING_MEMBERSHIP_MODES.has(primarySiblingMembershipMode)
  );
}

async function assertRoleDefaultCompatibility(
  tx: Parameters<typeof can>[0],
  args: {
    groupId: string;
    assigneeKind: 'member' | 'guest';
    defaultRequestRole: boolean;
    defaultInviteRole: boolean;
  }
) {
  if (!args.defaultRequestRole && !args.defaultInviteRole) {
    return;
  }

  const group = await loadGroupWithDerivedNetworkMeta(tx, args.groupId);
  if (!group) {
    throw new Error('Group not found');
  }

  if (requiresGuestAccessFlow(group)) {
    if (args.assigneeKind !== 'guest') {
      throw new Error(
        'Only guest roles can be used as default membership request or invite roles for this group.'
      );
    }
    return;
  }

  if (args.assigneeKind === 'guest') {
    throw new Error('Guest roles cannot be used as default membership request or invite roles.');
  }
}

async function authorizeScopedRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  scope: {
    group_id?: string | null;
    event_id?: string | null;
    amendment_id?: string | null;
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

  if (scope.amendment_id) {
    await can(tx, ctx, {
      action: 'manage',
      resource: 'amendments',
      amendmentId: scope.amendment_id,
    });
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

async function authorizeRoleHolderHistoryMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  roleId: string
) {
  if (tx.location === 'client') return;

  const role = await loadRole(tx, roleId);
  await authorizeScopedRoleMutation(tx, ctx, role);
}

async function authorizeExistingRoleHolderHistoryMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  historyId: string
) {
  if (tx.location === 'client') return;

  const history = await tx.run(zql.role_holder_history.where('id', historyId).one());
  if (!history) {
    throw new Error('Role holder history not found');
  }

  await authorizeRoleHolderHistoryMutation(tx, ctx, history.role_id);
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
  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
  if (!group) {
    throw new Error('Group not found');
  }

  if (group.group_type === 'hierarchical') {
    throw new Error('Cannot directly manage memberships in hierarchical groups.');
  }

  if (requiresGuestAccessFlow(group)) {
    throw new Error('This group only supports guest access requests and invitations.');
  }

  if (group.group_type === 'sibling') {
    if (group.primary_sibling_membership_mode !== 'none' || !group.connected_group_id) {
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
    id?: string;
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
  const id = args.id ?? crypto.randomUUID();

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

async function bootstrapGroupCreatorRbac(
  tx: Parameters<typeof can>[0],
  args: { groupId: string; creatorId: string; createdAt: number }
) {
  const totalRoles = DEFAULT_GROUP_ROLES.length;
  let adminRoleId: string | null = null;

  for (let index = 0; index < totalRoles; index++) {
    const roleDef = DEFAULT_GROUP_ROLES[index];
    const roleId = await creatorRoleId('group', args.groupId, roleDef.name);
    if (roleDef.name === 'Admin') adminRoleId = roleId;

    await tx.mutate.role.insert({
      id: roleId,
      name: roleDef.name,
      description: roleDef.description,
      scope: 'group',
      group_id: args.groupId,
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
      created_at: args.createdAt,
    });

    for (const permission of roleDef.permissions) {
      await tx.mutate.action_right.insert({
        id: await creatorActionRightId(
          'group',
          args.groupId,
          roleDef.name,
          permission.resource,
          permission.action
        ),
        resource: permission.resource,
        action: permission.action,
        role_id: roleId,
        group_id: args.groupId,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        created_at: args.createdAt,
      });
    }
  }

  if (!adminRoleId) throw new Error('Default Admin role is missing');

  const membershipId = await creatorRbacId(
    'group',
    args.groupId,
    'creator-membership',
    args.creatorId
  );
  await tx.mutate.group_membership.insert({
    id: membershipId,
    group_id: args.groupId,
    user_id: args.creatorId,
    status: 'active',
    visibility: 'public',
    source: 'direct',
    source_group_id: null,
    created_at: args.createdAt,
  });
  await addGroupMembershipRole(tx, {
    id: await creatorRbacId(
      'group',
      args.groupId,
      'creator-membership-role',
      args.creatorId,
      'Admin'
    ),
    group_membership_id: membershipId,
    role_id: adminRoleId,
    assigned_by_id: args.creatorId,
  });
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

async function resolveDefaultGuestRoleId(
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
  const guestRoles = roles.filter(role => role.assignee_kind === 'guest');

  if (status === 'requested') {
    const configuredRole = guestRoles.find(role => role.default_request_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  if (status === 'invited') {
    const configuredRole = guestRoles.find(role => role.default_invite_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  return guestRoles.find(role => role.name === 'Guest')?.id ?? guestRoles[0]?.id ?? null;
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

  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
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

export const groupSharedMutatorInternals = {
  isAllowedAmendmentActionRight,
  requiresGuestAccessFlow,
  assertRoleDefaultCompatibility,
  authorizeScopedRoleMutation,
  loadMembershipForRoleMutation,
  loadOfflineMembershipForRoleMutation,
  loadGuestAccessForRoleMutation,
  loadRole,
  authorizeRoleHolderHistoryMutation,
  authorizeExistingRoleHolderHistoryMutation,
  assertRolesAssignableToMembers,
  assertRolesAssignableToGuests,
  assertCanDirectlyMutateOfficialMembership,
  addGroupMembershipRole,
  removeGroupMembershipRole,
  syncGroupMembershipRoles,
  addGroupOfflineMembershipRole,
  removeGroupOfflineMembershipRole,
  syncGroupOfflineMembershipRoles,
  addGroupGuestRole,
  removeGroupGuestRole,
  syncGroupGuestRoles,
  resolveDefaultMembershipRoleId,
  resolveDefaultGuestRoleId,
  assignDefaultInviteRoleToOfflineMembership,
  clearGroupRoleDefaults,
  normalizeOptionalReason,
  normalizeRequiredName,
  assertCanManageGroupOfflineMembers,
  loadGroupOfflineMemberForMutation,
  assertUniqueConnectedOfflineUserWithinGroup,
  bootstrapGroupCreatorRbac,
};

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const groupSharedMutators = {
  create: defineMutator(groupCreateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'groups' });
    const now = Date.now();

    await tx.mutate.group.insert({
      ...args,
      group_type: args.group_type ?? 'base',
      owner_id: userID,
      member_count: 1,
      signed_up_member_count: 1,
      subscriber_count: 0,
      event_count: 0,
      amendment_count: 0,
      document_count: 0,
      created_at: now,
      updated_at: now,
    });

    await bootstrapGroupCreatorRbac(tx, {
      groupId: args.id,
      creatorId: userID,
      createdAt: now,
    });
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.id,
      action: 'created',
      severity: 'high',
      createdAt: now,
      id: args.id,
    });
  }),

  createFull: defineMutator(groupFullCreateMutatorSchema, async ({ tx, ctx, args }) => {
    await groupSharedMutators.create.fn({ tx, ctx, args: args.group });
  }),

  update: defineMutator(groupUpdateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.id });
    const existingGroup = await tx.run(zql.group.where('id', args.id).one());
    if (!existingGroup) {
      throw new Error('Group not found');
    }

    await tx.mutate.group.update({ ...args, updated_at: Date.now() });
    const changes = buildActivityChanges(existingGroup, args, GROUP_ACTIVITY_FIELDS);
    if (changes.length > 0)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: args.id,
        action: 'updated',
        severity: severityForChanges(changes, HIGH_GROUP_FIELDS),
        changes,
      });
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
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.group_id,
      action: 'offline_member_added',
      severity: 'high',
      subjectUserId: args.connected_user_id ?? null,
      context: {
        offline_member_id: args.id,
        name: `${normalizeRequiredName(args.first_name)} ${normalizeRequiredName(args.last_name)}`,
      },
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
    const normalizedUpdate = {
      ...args,
      ...(args.first_name !== undefined
        ? { first_name: normalizeRequiredName(args.first_name) }
        : {}),
      ...(args.last_name !== undefined ? { last_name: normalizeRequiredName(args.last_name) } : {}),
      ...(args.reason_not_signed_up !== undefined
        ? { reason_not_signed_up: normalizeOptionalReason(args.reason_not_signed_up) }
        : {}),
    };
    const changes = buildActivityChanges(offlineMember, normalizedUpdate, [
      'first_name',
      'last_name',
      'reason_not_signed_up',
      'connected_user_id',
    ]);
    if (changes.length > 0)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: offlineMember.group_id,
        action: 'offline_member_updated',
        severity: 'normal',
        changes,
        subjectUserId: connectedUserId ?? null,
        context: { offline_member_id: offlineMember.id },
      });
  }),

  deleteOfflineMember: defineMutator(groupOfflineMemberDeleteSchema, async ({ tx, ctx, args }) => {
    const offlineMember = await loadGroupOfflineMemberForMutation(tx, ctx, args.id);
    await tx.mutate.group_offline_member.delete({ id: args.id });
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: offlineMember.group_id,
      action: 'offline_member_removed',
      severity: 'high',
      subjectUserId: offlineMember.connected_user_id ?? null,
      context: {
        offline_member_id: offlineMember.id,
        name: `${offlineMember.first_name} ${offlineMember.last_name}`,
      },
    });
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
      if (seenImportKeys.size > 0)
        await appendEntityActivity(tx, ctx, {
          table: 'group_activity',
          entityField: 'group_id',
          entityId: args.group_id,
          action: 'offline_members_imported',
          severity: 'high',
          context: { count: seenImportKeys.size },
        });
    }
  ),

  joinGroup: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'groupMemberships' });
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
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.group_id,
      action: 'membership_added',
      severity: 'high',
      subjectUserId: userID,
      context: {
        membership_id: args.id,
        status: args.status ?? null,
        role_ids: initialRoleId ? [initialRoleId] : [],
      },
    });
  }),

  requestGuestAccess: defineMutator(groupGuestAccessCreateSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'groupMemberships' });
    const group = await loadGroupWithDerivedNetworkMeta(tx, args.group_id);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!requiresGuestAccessFlow(group)) {
      throw new Error('This group uses official memberships for join requests.');
    }

    const existingMembership = await tx.run(
      zql.group_membership.where('group_id', args.group_id).where('user_id', userID).one()
    );
    if (existingMembership) {
      throw new Error('You already have a membership record for this group.');
    }

    const desiredRoleId = await resolveDefaultGuestRoleId(
      tx,
      args.group_id,
      'requested',
      args.role_ids?.[0] ?? null
    );

    const existingGuestAccess = await tx.run(
      zql.group_guest_access.where('group_id', args.group_id).where('user_id', userID).one()
    );

    if (existingGuestAccess?.status === 'active') {
      throw new Error('You already have guest access to this group.');
    }

    if (existingGuestAccess) {
      await tx.mutate.group_guest_access.update({
        id: existingGuestAccess.id,
        status: 'requested',
        invited_by_id: null,
        updated_at: Date.now(),
      });

      if (desiredRoleId) {
        await syncGroupGuestRoles(tx, {
          group_guest_access_id: existingGuestAccess.id,
          role_ids: [desiredRoleId],
          assigned_by_id: null,
        });
      }
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: args.group_id,
        action: 'guest_updated',
        severity: 'high',
        subjectUserId: userID,
        context: {
          guest_access_id: existingGuestAccess.id,
          status: 'requested',
          role_id: desiredRoleId,
        },
      });
      return;
    }

    const now = Date.now();
    await tx.mutate.group_guest_access.insert({
      id: args.id,
      group_id: args.group_id,
      user_id: userID,
      status: 'requested',
      invited_by_id: null,
      created_at: now,
      updated_at: now,
    });

    if (desiredRoleId) {
      await syncGroupGuestRoles(tx, {
        group_guest_access_id: args.id,
        role_ids: [desiredRoleId],
        assigned_by_id: null,
      });
    }
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.group_id,
      action: 'guest_added',
      severity: 'high',
      subjectUserId: userID,
      context: { guest_access_id: args.id, status: 'requested', role_id: desiredRoleId },
    });
  }),

  leaveGroup: defineMutator(groupMembershipDeleteSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (membership?.status === 'requested' && membership.user_id === ctx.userID) {
      const group = await tx.run(zql.group.where('id', membership.group_id).one());
      if (group?.tutorial_run_id) {
        return;
      }
    }
    if (membership && !isManualGroupMembershipSource(membership.source)) {
      throw new Error('Only direct memberships can be changed manually.');
    }
    if (membership && membership.user_id !== ctx.userID) {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupMemberships',
        groupId: membership.group_id,
      });
    }
    await tx.mutate.group_membership.delete({ id: args.id });
    if (membership)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: membership.group_id,
        action: 'membership_removed',
        severity: 'high',
        subjectUserId: membership.user_id,
        context: { membership_id: membership.id, status: membership.status ?? null },
      });
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
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.group_id,
      action: 'membership_added',
      severity: 'high',
      subjectUserId: args.user_id,
      context: {
        membership_id: args.id,
        status: 'invited',
        role_ids: initialRoleId ? [initialRoleId] : [],
      },
    });
  }),

  acceptInvitation: defineMutator(z.object({ id: z.string() }), async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (!membership) {
      throw new Error('Membership not found');
    }
    if (membership.user_id !== ctx.userID) {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupMemberships',
        groupId: membership.group_id,
      });
    }
    if (!isManualGroupMembershipSource(membership.source)) {
      throw new Error('Automatic memberships cannot be accepted manually.');
    }
    await tx.mutate.group_membership.update({ id: args.id, status: 'active' });
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: membership.group_id,
      action: 'membership_updated',
      severity: 'high',
      subjectUserId: membership.user_id,
      changes: [{ field: 'status', from: membership.status ?? null, to: 'active' }],
      context: { membership_id: membership.id },
    });
  }),

  addMembershipRole: defineMutator(groupMembershipRoleAssignSchema, async ({ tx, ctx, args }) => {
    const membership = await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
    await assertRolesAssignableToMembers(tx, [args.role_id], membership.group_id);
    await addGroupMembershipRole(tx, args);
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: membership.group_id,
      action: 'role_assigned',
      severity: 'high',
      subjectUserId: membership.user_id,
      context: { membership_id: membership.id, role_id: args.role_id },
    });
  }),

  removeMembershipRole: defineMutator(
    groupMembershipRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      const membership = await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
      await removeGroupMembershipRole(tx, args);
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: membership.group_id,
        action: 'role_unassigned',
        severity: 'high',
        subjectUserId: membership.user_id,
        context: { membership_id: membership.id, role_id: args.role_id },
      });
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

  updateMembership: defineMutator(groupMembershipUpdateSchema, async ({ tx, ctx, args }) => {
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (!membership) {
      throw new Error('Membership not found');
    }
    if (!isManualGroupMembershipSource(membership.source)) {
      throw new Error('Only direct memberships can be changed manually.');
    }

    await can(tx, ctx, {
      action: 'manage',
      resource: 'groupMemberships',
      groupId: membership.group_id,
    });

    if (Object.keys(args).length > 1) {
      await tx.mutate.group_membership.update(args);
      const changes = buildActivityChanges(membership, args, ['status', 'visibility']);
      if (changes.length > 0)
        await appendEntityActivity(tx, ctx, {
          table: 'group_activity',
          entityField: 'group_id',
          entityId: membership.group_id,
          action: 'membership_updated',
          severity: 'high',
          subjectUserId: membership.user_id,
          changes,
          context: { membership_id: membership.id },
        });
    }
  }),

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
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: args.group_id,
        action: 'guest_updated',
        severity: 'high',
        subjectUserId: args.user_id,
        context: {
          guest_access_id: existingGuestAccess.id,
          status: 'invited',
          role_ids: desiredRoleIds,
        },
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
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: args.group_id,
      action: 'guest_added',
      severity: 'high',
      subjectUserId: args.user_id,
      context: { guest_access_id: args.id, status: args.status, role_ids: desiredRoleIds },
    });
  }),

  acceptGuestInvitation: defineMutator(groupGuestAccessAcceptSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(zql.group_guest_access.where('id', args.id).one());
    if (!guestAccess) {
      throw new Error('Guest access not found');
    }

    if (ctx.userID !== guestAccess.user_id) {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupMemberships',
        groupId: guestAccess.group_id,
      });
    }

    await tx.mutate.group_guest_access.update({
      id: args.id,
      status: 'active',
      updated_at: Date.now(),
    });
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: guestAccess.group_id,
      action: 'guest_updated',
      severity: 'high',
      subjectUserId: guestAccess.user_id,
      changes: [{ field: 'status', from: guestAccess.status, to: 'active' }],
      context: { guest_access_id: guestAccess.id },
    });
  }),

  revokeGuestAccess: defineMutator(groupGuestAccessDeleteSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await tx.run(zql.group_guest_access.where('id', args.id).one());
    if (!guestAccess) {
      throw new Error('Guest access not found');
    }

    if (ctx.userID !== guestAccess.user_id) {
      await can(tx, ctx, {
        action: 'manage',
        resource: 'groupMemberships',
        groupId: guestAccess.group_id,
      });
    }

    await tx.mutate.group_guest_access.update({
      id: guestAccess.id,
      status: 'revoked',
      updated_at: Date.now(),
    });
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: guestAccess.group_id,
      action: 'guest_removed',
      severity: 'high',
      subjectUserId: guestAccess.user_id,
      changes: [{ field: 'status', from: guestAccess.status, to: 'revoked' }],
      context: { guest_access_id: guestAccess.id },
    });
  }),

  addGuestRole: defineMutator(groupGuestRoleAssignSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await loadGuestAccessForRoleMutation(tx, ctx, args.group_guest_access_id);
    await assertRolesAssignableToGuests(tx, guestAccess.group_id, [args.role_id]);
    await addGroupGuestRole(tx, args);
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: guestAccess.group_id,
      action: 'role_assigned',
      severity: 'high',
      subjectUserId: guestAccess.user_id,
      context: { guest_access_id: guestAccess.id, role_id: args.role_id },
    });
  }),

  removeGuestRole: defineMutator(groupGuestRoleUnassignSchema, async ({ tx, ctx, args }) => {
    const guestAccess = await loadGuestAccessForRoleMutation(tx, ctx, args.group_guest_access_id);
    await removeGroupGuestRole(tx, args);
    await appendEntityActivity(tx, ctx, {
      table: 'group_activity',
      entityField: 'group_id',
      entityId: guestAccess.group_id,
      action: 'role_unassigned',
      severity: 'high',
      subjectUserId: guestAccess.user_id,
      context: { guest_access_id: guestAccess.id, role_id: args.role_id },
    });
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
    if (args.group_id) {
      await assertRoleDefaultCompatibility(tx, {
        groupId: args.group_id,
        assigneeKind,
        defaultRequestRole: Boolean(args.default_request_role),
        defaultInviteRole: Boolean(args.default_invite_role),
      });
    }
    if (args.group_id) {
      await clearGroupRoleDefaults(tx, {
        groupId: args.group_id,
        clearRequestDefault: Boolean(args.default_request_role),
        clearInviteDefault: Boolean(args.default_invite_role),
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
    if (args.group_id)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: args.group_id,
        action: 'role_created',
        severity: 'high',
        context: { role_id: args.id, name: args.name ?? null, assignee_kind: assigneeKind },
      });
  }),

  updateRole: defineMutator(roleUpdateSchema, async ({ tx, ctx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role) {
      await authorizeScopedRoleMutation(tx, ctx, role);
      const nextAssigneeKind =
        (args.assignee_kind ?? role.assignee_kind) === 'guest' ? 'guest' : 'member';
      const nextDefaultRequestRole = args.default_request_role ?? role.default_request_role;
      const nextDefaultInviteRole = args.default_invite_role ?? role.default_invite_role;
      if (role.group_id) {
        await assertRoleDefaultCompatibility(tx, {
          groupId: role.group_id,
          assigneeKind: nextAssigneeKind,
          defaultRequestRole: nextDefaultRequestRole,
          defaultInviteRole: nextDefaultInviteRole,
        });
        await clearGroupRoleDefaults(tx, {
          groupId: role.group_id,
          keepRoleId: role.id,
          clearRequestDefault: args.default_request_role === true,
          clearInviteDefault: args.default_invite_role === true,
        });
      }
    }
    await tx.mutate.role.update(args);
    if (role?.group_id) {
      const changes = buildActivityChanges(
        role,
        args,
        Object.keys(args).filter(key => key !== 'id')
      );
      if (changes.length > 0)
        await appendEntityActivity(tx, ctx, {
          table: 'group_activity',
          entityField: 'group_id',
          entityId: role.group_id,
          action: 'role_updated',
          severity: 'high',
          changes,
          context: { role_id: role.id, name: role.name ?? null },
        });
    }
  }),

  deleteRole: defineMutator(roleDeleteSchema, async ({ tx, ctx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role) {
      await authorizeScopedRoleMutation(tx, ctx, role);
    }
    await tx.mutate.role.delete({ id: args.id });
    if (role?.group_id)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: role.group_id,
        action: 'role_deleted',
        severity: 'high',
        context: { role_id: role.id, name: role.name ?? null },
      });
  }),

  assignActionRight: defineMutator(actionRightCreateSchema, async ({ tx, ctx, args }) => {
    if (args.amendment_id && !isAllowedAmendmentActionRight(args.resource, args.action)) {
      throw new Error(
        `Action right ${args.resource}:${args.action} is not valid for amendment roles.`
      );
    }
    await authorizeScopedRoleMutation(tx, ctx, args);
    const role = await tx.run(zql.role.where('id', args.role_id).one());
    if (args.amendment_id && (!role || role.amendment_id !== args.amendment_id)) {
      throw new Error('Action right scope does not match amendment role scope.');
    }
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
    if (role?.group_id)
      await appendEntityActivity(tx, ctx, {
        table: 'group_activity',
        entityField: 'group_id',
        entityId: role.group_id,
        action: 'right_assigned',
        severity: 'high',
        context: {
          action_right_id: args.id,
          role_id: args.role_id,
          resource: args.resource,
          right: args.action,
        },
      });
  }),

  removeActionRight: defineMutator(actionRightDeleteSchema, async ({ tx, ctx, args }) => {
    const actionRight = await tx.run(zql.action_right.where('id', args.id).one());
    if (actionRight) {
      await authorizeScopedRoleMutation(tx, ctx, actionRight);
    }
    await tx.mutate.action_right.delete({ id: args.id });
    if (actionRight) {
      const role = await tx.run(zql.role.where('id', actionRight.role_id).one());
      if (role?.group_id)
        await appendEntityActivity(tx, ctx, {
          table: 'group_activity',
          entityField: 'group_id',
          entityId: role.group_id,
          action: 'right_unassigned',
          severity: 'high',
          context: {
            action_right_id: actionRight.id,
            role_id: actionRight.role_id,
            resource: actionRight.resource,
            right: actionRight.action,
          },
        });
    }
  }),

  // Role holder history mutators
  createRoleHolderHistory: defineMutator(
    roleHolderHistoryCreateSchema,
    async ({ tx, ctx, args }) => {
      await authorizeRoleHolderHistoryMutation(tx, ctx, args.role_id);

      const now = Date.now();
      await tx.mutate.role_holder_history.insert({
        ...args,
        created_at: now,
      });
    }
  ),

  updateRoleHolderHistory: defineMutator(
    roleHolderHistoryUpdateSchema,
    async ({ tx, ctx, args }) => {
      await authorizeExistingRoleHolderHistoryMutation(tx, ctx, args.id);

      await tx.mutate.role_holder_history.update(args);
    }
  ),
};
