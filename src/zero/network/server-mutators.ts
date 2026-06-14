import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { can } from '../rbac/can';
import { zql } from '../schema';
import {
  approveGroupConnectionRequestSchema,
  createGroupConnectionSchema,
  deleteGroupConnectionSchema,
  proposeGroupConnectionChangeSchema,
  rejectGroupConnectionRequestSchema,
  updateGroupConnectionSchema,
} from './schema';
import {
  approveGroupConnectionRequest,
  deleteGroupConnectionAndRequests,
  proposeGroupConnectionChange,
  rejectGroupConnectionRequest,
} from './mutator-helpers';
import {
  assertConnectionEndpoints,
  assertHierarchyGraphIsUnambiguous,
  type GroupConnectionShape,
} from './connectionValidation';
import {
  buildGroupsById,
  reconcileHierarchyForBaseGroup,
  loadGroupWithDerivedNetworkMeta,
  recomputeSiblingGroupMemberships,
} from '../groups/membership-helpers';
import { reconcileDelegateAllocationsForGroups } from '../events/delegate-allocation-reconcile';
import { reconcileGeneralAssemblyParticipantsForGroups } from '../events/assembly-reconcile';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const GUEST_ONLY_SIBLING_MEMBERSHIP_MODES = new Set([
  'all_members',
  'role_members',
  'selected_source_groups',
]);

function requiresGuestAccessFlow(group: {
  group_type?: string | null;
  primary_sibling_membership_mode?: string | null;
}) {
  return (
    group.group_type === 'sibling' &&
    group.primary_sibling_membership_mode != null &&
    GUEST_ONLY_SIBLING_MEMBERSHIP_MODES.has(group.primary_sibling_membership_mode)
  );
}

async function reconcileGroupRoleDefaultsForMembershipMode(tx: any, groupId: string) {
  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
  if (!group) {
    return;
  }
  const roles = await tx.run(
    zql.role.where('group_id', groupId).where('scope', 'group').orderBy('sort_order', 'asc')
  );
  const memberRoles = roles.filter((role: any) => role.assignee_kind !== 'guest');
  const guestRoles = roles.filter((role: any) => role.assignee_kind === 'guest');
  const guestOnlyFlow = requiresGuestAccessFlow(group);
  const now = Date.now();

  if (guestOnlyFlow) {
    let preferredGuestRole =
      guestRoles.find((role: any) => role.default_request_role || role.default_invite_role) ??
      guestRoles.find((role: any) => role.name === 'Guest') ??
      guestRoles[0] ??
      null;
    if (!preferredGuestRole) {
      const id = crypto.randomUUID();
      await tx.mutate.role.insert({
        id,
        name: 'Guest',
        description: translateText(
          'generated.inline.0684_default_guest_access_role_for_connected_membe_b9c68590'
        ),
        scope: 'group',
        group_id: groupId,
        event_id: null,
        amendment_id: null,
        blog_id: null,
        assignment_mode: 'assigned',
        visibility: 'private',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: true,
        default_invite_role: true,
        assignee_kind: 'guest',
        sort_order: -1,
        created_at: now,
      });
      preferredGuestRole = { id };
    }
    for (const role of roles) {
      const selected = role.id === preferredGuestRole.id;
      if (role.default_request_role !== selected || role.default_invite_role !== selected) {
        await tx.mutate.role.update({
          id: role.id,
          default_request_role: selected,
          default_invite_role: selected,
        });
      }
    }
    return;
  }

  const preferredMemberRole =
    memberRoles.find((role: any) => role.default_request_role || role.default_invite_role) ??
    memberRoles.find((role: any) => role.name === 'Member') ??
    memberRoles[0] ??
    null;
  for (const role of guestRoles) {
    if (role.default_request_role || role.default_invite_role) {
      await tx.mutate.role.update({
        id: role.id,
        default_request_role: false,
        default_invite_role: false,
      });
    }
  }
  if (!preferredMemberRole) {
    return;
  }
  for (const role of memberRoles) {
    const selected = role.id === preferredMemberRole.id;
    if (role.default_request_role !== selected || role.default_invite_role !== selected) {
      await tx.mutate.role.update({
        id: role.id,
        default_request_role: selected,
        default_invite_role: selected,
      });
    }
  }
}

async function reconcileConnectionSideEffects(
  tx: any,
  assignedById: string,
  groupIds: readonly (string | null | undefined)[]
) {
  const affected = [...new Set(groupIds.filter((id): id is string => Boolean(id)))];
  if (affected.length === 0) {
    return;
  }
  const groupsById = await buildGroupsById(tx);
  const groups = [...groupsById.values()];
  const allGroupIds = groups.map(group => group.id);
  for (const group of groups) {
    if (group.group_type === 'base') {
      await reconcileHierarchyForBaseGroup(tx, group.id, assignedById);
    }
  }
  for (const groupId of allGroupIds) {
    await recomputeSiblingGroupMemberships(tx, groupId, assignedById);
    await reconcileGroupRoleDefaultsForMembershipMode(tx, groupId);
  }
  await reconcileGeneralAssemblyParticipantsForGroups(tx, allGroupIds, assignedById);
  await reconcileDelegateAllocationsForGroups(tx, allGroupIds);
}

async function assertPayload(
  tx: any,
  args: {
    id: string;
    group_a_id: string;
    group_b_id: string;
    connection_type: 'hierarchy' | 'peer';
    parent_group_id?: string | null;
    child_group_id?: string | null;
    grants?: readonly { holder_group_id: string; scope_group_id: string }[];
    membership_rule?: {
      member_source_group_id: string;
      member_target_group_id: string;
      membership_mode: string;
      required_source_role_id?: string | null;
      eligible_origin_group_ids?: readonly string[];
    } | null;
  }
) {
  const connection: GroupConnectionShape = {
    id: args.id,
    group_a_id: args.group_a_id,
    group_b_id: args.group_b_id,
    connection_type: args.connection_type,
    parent_group_id: args.parent_group_id ?? null,
    child_group_id: args.child_group_id ?? null,
  };
  assertConnectionEndpoints({
    connection,
    grants: args.grants,
    membershipRule: args.membership_rule,
  });

  if (args.membership_rule?.required_source_role_id) {
    const role = await tx.run(
      zql.role.where('id', args.membership_rule.required_source_role_id).one()
    );
    if (!role || role.group_id !== args.membership_rule.member_source_group_id) {
      throw new Error('The required membership role must belong to the member source group.');
    }
  }

  const existingConnections = await tx.run(zql.group_connection);
  assertHierarchyGraphIsUnambiguous([
    ...existingConnections.filter((item: any) => item.id !== args.id),
    { ...connection, status: 'active' },
  ]);
}

async function assertCanManageGroupRelationship(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupId: string | null | undefined
) {
  if (!groupId) return;
  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupRelationships',
    groupId,
  });
}

async function assertCanManageConnection(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  }
) {
  const groupIds = new Set(
    [
      connection.group_a_id,
      connection.group_b_id,
      connection.parent_group_id,
      connection.child_group_id,
    ].filter(Boolean)
  );

  for (const groupId of groupIds) {
    await assertCanManageGroupRelationship(tx, ctx, groupId);
  }
}

export const networkServerMutators = {
  createGroupConnection: defineMutator(createGroupConnectionSchema, async ({ tx, ctx, args }) => {
    await assertPayload(tx, {
      ...args,
      grants: args.grants,
      membership_rule: args.membership_rule,
    });
    await mutators.network.createGroupConnection.fn({ tx, ctx, args });
    await reconcileConnectionSideEffects(tx, ctx.userID, [args.group_a_id, args.group_b_id]);
  }),

  updateGroupConnection: defineMutator(updateGroupConnectionSchema, async ({ tx, ctx, args }) => {
    const existing = await tx.run(zql.group_connection.where('id', args.id).one());
    if (!existing) {
      throw new Error('Group connection not found');
    }
    const grants =
      args.grants ?? (await tx.run(zql.group_right_grant.where('connection_id', args.id)));
    const membershipRule =
      args.membership_rule === undefined
        ? await tx.run(zql.group_membership_rule.where('connection_id', args.id).one())
        : args.membership_rule;
    if (existing.connection_type !== 'hierarchy' && existing.connection_type !== 'peer') {
      throw new Error('Unsupported group connection type');
    }
    await assertPayload(tx, {
      id: args.id,
      group_a_id: args.group_a_id ?? existing.group_a_id,
      group_b_id: args.group_b_id ?? existing.group_b_id,
      connection_type: args.connection_type ?? existing.connection_type,
      parent_group_id: args.parent_group_id ?? existing.parent_group_id,
      child_group_id: args.child_group_id ?? existing.child_group_id,
      grants,
      membership_rule: membershipRule,
    });
    await mutators.network.updateGroupConnection.fn({ tx, ctx, args });
    await reconcileConnectionSideEffects(tx, ctx.userID, [
      existing.group_a_id,
      existing.group_b_id,
      args.group_a_id,
      args.group_b_id,
    ]);
  }),

  deleteGroupConnection: defineMutator(deleteGroupConnectionSchema, async ({ tx, ctx, args }) => {
    const existing = await tx.run(zql.group_connection.where('id', args.id).one());
    if (existing) {
      await assertCanManageConnection(tx, ctx, existing);
    }

    await deleteGroupConnectionAndRequests(tx, args.id);
    if (existing) {
      await reconcileConnectionSideEffects(tx, ctx.userID, [
        existing.group_a_id,
        existing.group_b_id,
      ]);
    }
  }),

  proposeGroupConnectionChange: defineMutator(
    proposeGroupConnectionChangeSchema,
    async ({ tx, ctx, args }) => {
      await assertCanManageGroupRelationship(tx, ctx, args.initiator_group_id);

      await assertPayload(tx, {
        id: args.active_connection_id ?? args.proposed_connection_id,
        group_a_id: args.group_a_id,
        group_b_id: args.group_b_id,
        connection_type: args.desired_connection_type,
        parent_group_id: args.desired_parent_group_id,
        child_group_id: args.desired_child_group_id,
        grants: args.grants.filter(item => item.operation === 'upsert'),
        membership_rule: args.membership_rule?.operation === 'upsert' ? args.membership_rule : null,
      });
      await proposeGroupConnectionChange(tx, args);
      await reconcileConnectionSideEffects(tx, ctx.userID, [args.group_a_id, args.group_b_id]);
    }
  ),

  approveGroupConnectionRequest: defineMutator(
    approveGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      const request = await tx.run(zql.group_connection_request.where('id', args.id).one());
      if (!request) {
        throw new Error('Group connection request not found');
      }
      await assertCanManageConnection(tx, ctx, {
        group_a_id: request.group_a_id,
        group_b_id: request.group_b_id,
        parent_group_id: request.desired_parent_group_id,
        child_group_id: request.desired_child_group_id,
      });

      const grantRequests = await tx.run(
        zql.group_right_grant_request.where('connection_request_id', args.id)
      );
      const membershipRequests = await tx.run(
        zql.group_membership_rule_request.where('connection_request_id', args.id)
      );
      const membershipRequest =
        [...membershipRequests].sort(
          (left, right) =>
            (right.updated_at ?? right.created_at ?? 0) - (left.updated_at ?? left.created_at ?? 0)
        )[0] ?? null;
      const origins = membershipRequest
        ? await tx.run(
            zql.group_membership_rule_request_origin.where(
              'membership_rule_request_id',
              membershipRequest.id
            )
          )
        : [];
      if (
        request.desired_connection_type !== 'hierarchy' &&
        request.desired_connection_type !== 'peer'
      ) {
        throw new Error('Unsupported requested group connection type');
      }
      const requestedMembership =
        membershipRequest?.operation === 'upsert' &&
        membershipRequest.member_source_group_id &&
        membershipRequest.member_target_group_id &&
        membershipRequest.membership_mode
          ? {
              member_source_group_id: membershipRequest.member_source_group_id,
              member_target_group_id: membershipRequest.member_target_group_id,
              membership_mode: membershipRequest.membership_mode,
              required_source_role_id: membershipRequest.required_source_role_id,
              eligible_origin_group_ids: origins.map(
                (origin: any) => origin.eligible_origin_group_id
              ),
            }
          : null;
      await assertPayload(tx, {
        id: request.active_connection_id ?? request.proposed_connection_id,
        group_a_id: request.group_a_id,
        group_b_id: request.group_b_id,
        connection_type: request.desired_connection_type,
        parent_group_id: request.desired_parent_group_id,
        child_group_id: request.desired_child_group_id,
        grants: grantRequests.filter((item: any) => item.operation === 'upsert'),
        membership_rule: requestedMembership,
      });
      await approveGroupConnectionRequest(
        tx,
        args.id,
        args.grant_request_ids,
        args.approve_membership
      );
      await reconcileConnectionSideEffects(tx, ctx.userID, [
        request.group_a_id,
        request.group_b_id,
      ]);
    }
  ),

  rejectGroupConnectionRequest: defineMutator(
    rejectGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      const existingRequest = await tx.run(zql.group_connection_request.where('id', args.id).one());
      if (!existingRequest) {
        throw new Error('Group connection request not found');
      }
      await assertCanManageConnection(tx, ctx, {
        group_a_id: existingRequest.group_a_id,
        group_b_id: existingRequest.group_b_id,
        parent_group_id: existingRequest.desired_parent_group_id,
        child_group_id: existingRequest.desired_child_group_id,
      });

      const request = await rejectGroupConnectionRequest(
        tx,
        args.id,
        args.grant_request_ids,
        args.reject_membership,
        args.reject_structure
      );
      await reconcileConnectionSideEffects(tx, ctx.userID, [
        request.group_a_id,
        request.group_b_id,
      ]);
    }
  ),
};
