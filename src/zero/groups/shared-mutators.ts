import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { zql } from '../schema';
import {
  groupCreateSchema,
  groupUpdateSchema,
  groupDeleteSchema,
  groupMembershipCreateSchema,
  groupMembershipLegacyRoleUpdateSchema,
  groupMembershipDeleteSchema,
  groupMembershipRoleAssignSchema,
  groupMembershipRoleUnassignSchema,
  groupMembershipRolesSyncSchema,
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

  if (status === 'requested') {
    const configuredRole = roles.find(role => role.default_request_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  if (status === 'invited') {
    const configuredRole = roles.find(role => role.default_invite_role);
    if (configuredRole?.id) {
      return configuredRole.id;
    }
  }

  return roles.find(role => role.name === 'Member')?.id ?? null;
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

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const groupSharedMutators = {
  create: defineMutator(groupCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.group.insert({
      ...args,
      owner_id: userID,
      member_count: 1,
      subscriber_count: 0,
      event_count: 0,
      amendment_count: 0,
      document_count: 0,
      created_at: now,
      updated_at: now,
    });
  }),

  update: defineMutator(groupUpdateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.id });
    await tx.mutate.group.update({ ...args, updated_at: Date.now() });
  }),

  delete: defineMutator(groupDeleteSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.id });
    await tx.mutate.group.delete({ id: args.id });
  }),

  joinGroup: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    // Guard: cannot join hierarchical groups directly
    const group = await tx.run(zql.group.where('id', args.group_id).one());
    if (group?.group_type === 'hierarchical') {
      throw new Error('Cannot join hierarchical groups directly. Join a base subgroup instead.');
    }

    const now = Date.now();
    const { initial_role_id, ...membershipArgs } = args;
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
    // Guard: cannot leave derived memberships directly
    const membership = await tx.run(zql.group_membership.where('id', args.id).one());
    if (membership?.source === 'derived') {
      throw new Error('Cannot leave a derived membership. Leave the base group instead.');
    }
    await tx.mutate.group_membership.delete({ id: args.id });
  }),

  inviteMember: defineMutator(groupMembershipCreateSchema, async ({ tx, ctx, args }) => {
    await can(tx, ctx, { action: 'manage', resource: 'groupMemberships', groupId: args.group_id });
    if (!args.user_id) throw new Error('user_id is required for inviteMember');

    // Guard: cannot invite to hierarchical groups
    const group = await tx.run(zql.group.where('id', args.group_id).one());
    if (group?.group_type === 'hierarchical') {
      throw new Error('Cannot invite to hierarchical groups. Add members to base subgroups.');
    }

    const now = Date.now();
    const { initial_role_id, ...membershipArgs } = args;
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
    await tx.mutate.group_membership.update({ id: args.id, status: 'active' });
  }),

  addMembershipRole: defineMutator(groupMembershipRoleAssignSchema, async ({ tx, ctx, args }) => {
    await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
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
    await loadMembershipForRoleMutation(tx, ctx, args.group_membership_id);
    await syncGroupMembershipRoles(tx, args);
  }),

  updateMemberRole: defineMutator(
    groupMembershipLegacyRoleUpdateSchema,
    async ({ tx, ctx, args }) => {
      const { role_id, ...membershipArgs } = args;

      if (Object.keys(membershipArgs).length > 1) {
        await tx.mutate.group_membership.update(membershipArgs);
      }

      if (role_id !== undefined) {
        await loadMembershipForRoleMutation(tx, ctx, args.id);
        await syncGroupMembershipRoles(tx, {
          group_membership_id: args.id,
          role_ids: role_id ? [role_id] : [],
          assigned_by_id: ctx.userID,
        });
      }
    }
  ),

  createRole: defineMutator(roleCreateSchema, async ({ tx, ctx, args }) => {
    await authorizeScopedRoleMutation(tx, ctx, args);
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
      default_request_role: args.default_request_role ?? false,
      default_invite_role: args.default_invite_role ?? false,
      created_at: now,
    });
  }),

  updateRole: defineMutator(roleUpdateSchema, async ({ tx, ctx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role) {
      await authorizeScopedRoleMutation(tx, ctx, role);
      if (role.group_id) {
        await clearGroupRoleDefaults(tx, {
          groupId: role.group_id,
          keepRoleId: role.id,
          clearRequestDefault: args.default_request_role === true,
          clearInviteDefault: args.default_invite_role === true,
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
  createRelationship: defineMutator(createGroupRelationshipSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.group_relationship.insert({ ...args, created_at: now });
  }),

  updateRelationship: defineMutator(updateGroupRelationshipSchema, async ({ tx, args }) => {
    await tx.mutate.group_relationship.update(args);
  }),

  deleteRelationship: defineMutator(deleteGroupRelationshipSchema, async ({ tx, args }) => {
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
