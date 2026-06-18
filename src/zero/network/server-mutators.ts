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
  loadGroupWithDerivedNetworkMeta,
  recomputeSiblingGroupMemberships,
} from '../groups/membership-helpers';
import { reconcileOfflineHierarchyForBaseGroup } from '../groups/offline-membership-helpers';
import { reconcileDelegateAllocationsForGroups } from '../events/delegate-allocation-reconcile';
import { reconcileGeneralAssemblyParticipantsForGroups } from '../events/assembly-reconcile';
import { reconcileGroupGraph } from './group-graph-reconcile';
import { fireNotification } from '../server-notify';
import {
  groupName,
  recomputeGroupCounters,
  recomputeUserCounters,
  syncUserWithGroupConversation,
} from '../server-helpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { assertNoBlockingGroupConflicts } from '@/server/group-conflict-validation';

const GUEST_ONLY_SIBLING_MEMBERSHIP_MODES = new Set([
  'all_members',
  'role_members',
  'selected_source_groups',
]);
const GROUP_MEMBERSHIP_MODES = ['all_members', 'role_members', 'selected_source_groups'] as const;

function isGroupMembershipMode(value: unknown): value is (typeof GROUP_MEMBERSHIP_MODES)[number] {
  return GROUP_MEMBERSHIP_MODES.some(mode => mode === value);
}

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
  const firstGraphResult = await reconcileGroupGraph(tx, {
    groupIds: allGroupIds,
    assignedById,
    reason: 'network-connection-side-effects-hierarchy',
  });
  const offlineHierarchyAffectedGroupIds = new Set<string>();
  for (const groupId of allGroupIds) {
    const { affectedGroupIds } = await reconcileOfflineHierarchyForBaseGroup(tx, groupId);
    for (const affectedGroupId of affectedGroupIds) {
      offlineHierarchyAffectedGroupIds.add(affectedGroupId);
    }
  }
  for (const groupId of allGroupIds) {
    await recomputeSiblingGroupMemberships(tx, groupId, assignedById);
    await reconcileGroupRoleDefaultsForMembershipMode(tx, groupId);
  }
  await reconcileGeneralAssemblyParticipantsForGroups(tx, allGroupIds, assignedById);
  await reconcileDelegateAllocationsForGroups(tx, allGroupIds);
  const finalGraphResult = await reconcileGroupGraph(tx, {
    groupIds: allGroupIds,
    assignedById,
    reason: 'network-connection-side-effects',
  });
  const affectedGroupIds = new Set([
    ...firstGraphResult.affectedGroupIds,
    ...offlineHierarchyAffectedGroupIds,
    ...finalGraphResult.affectedGroupIds,
  ]);
  const affectedUserIds = new Set([
    ...firstGraphResult.affectedUserIds,
    ...finalGraphResult.affectedUserIds,
  ]);
  const affectedMembershipPairs = new Set([
    ...firstGraphResult.affectedMembershipPairs,
    ...finalGraphResult.affectedMembershipPairs,
  ]);

  for (const groupId of affectedGroupIds) {
    await recomputeGroupCounters(tx, groupId);
  }
  for (const userId of affectedUserIds) {
    await recomputeUserCounters(tx, userId);
  }
  for (const membershipPair of affectedMembershipPairs) {
    const [groupId, userId] = membershipPair.split(':');
    if (groupId && userId) {
      await syncUserWithGroupConversation(tx, { groupId, userId });
    }
  }
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

function assertGroupBelongsToConnection(
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  },
  groupId: string
) {
  const groupIds = new Set(
    [
      connection.group_a_id,
      connection.group_b_id,
      connection.parent_group_id,
      connection.child_group_id,
    ].filter(Boolean)
  );

  if (!groupIds.has(groupId)) {
    throw new Error('Acting group is not part of this connection');
  }
}

async function assertCanDeleteConnectionFromActingGroup(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  },
  actingGroupId: string
) {
  assertGroupBelongsToConnection(connection, actingGroupId);
  await assertCanManageGroupRelationship(tx, ctx, actingGroupId);
}

async function assertCanManageConnectionRequestCounterparty(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  request: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    initiator_group_id?: string | null;
  }
) {
  const endpointGroupIds = [
    ...new Set([request.group_a_id, request.group_b_id].filter((id): id is string => Boolean(id))),
  ];
  const counterpartyGroupIds = endpointGroupIds.filter(id => id !== request.initiator_group_id);
  const groupIdsToCheck = counterpartyGroupIds.length > 0 ? counterpartyGroupIds : endpointGroupIds;

  for (const groupId of groupIdsToCheck) {
    await assertCanManageGroupRelationship(tx, ctx, groupId);
  }
}

function getPendingGrantRequestsForApproval(
  grantRequests: readonly any[],
  grantRequestIds?: readonly string[] | null
) {
  const selectedIds =
    grantRequestIds === undefined || grantRequestIds === null ? null : new Set(grantRequestIds);

  return grantRequests.filter(
    item =>
      item.status === 'pending' &&
      item.operation === 'upsert' &&
      (!selectedIds || selectedIds.has(item.id))
  );
}

function shouldApproveMembershipRequest(
  membershipRequest: any,
  grantRequestIds?: readonly string[] | null,
  approveMembership?: boolean
) {
  const approvingAllGrantRequests = grantRequestIds === undefined || grantRequestIds === null;
  return (
    membershipRequest?.status === 'pending' &&
    (approveMembership === true || (approveMembership == null && approvingAllGrantRequests))
  );
}

function getOtherConnectionGroupId(
  connection: { group_a_id: string; group_b_id: string },
  groupId: string | null | undefined
) {
  return connection.group_a_id === groupId ? connection.group_b_id : connection.group_a_id;
}

async function notifyRelationshipRequestCreated(
  tx: Parameters<typeof can>[0],
  senderId: string,
  args: {
    group_a_id: string;
    group_b_id: string;
    desired_connection_type: string;
    initiator_group_id: string;
  }
) {
  const targetGroupId = getOtherConnectionGroupId(args, args.initiator_group_id);
  const [sourceGroupName, targetGroupName] = await Promise.all([
    groupName(tx, args.initiator_group_id),
    groupName(tx, targetGroupId),
  ]);
  const notificationParams = {
    senderId,
    sourceGroupId: args.initiator_group_id,
    sourceGroupName,
    targetGroupId,
    targetGroupName,
    relationshipType: args.desired_connection_type,
  };

  fireNotification('notifyRelationshipRequested', {
    ...notificationParams,
    recipientGroupId: targetGroupId,
  });
  fireNotification('notifyRelationshipRequested', {
    ...notificationParams,
    recipientGroupId: args.initiator_group_id,
  });
}

function shouldNotifyRelationshipApproval(args: {
  request: { structure_status?: string | null };
  grantRequests: readonly any[];
  membershipRequest?: any;
  grantRequestIds?: readonly string[] | null;
  approveMembership?: boolean;
}) {
  return (
    args.request.structure_status !== 'approved' ||
    getPendingGrantRequestsForApproval(args.grantRequests, args.grantRequestIds).length > 0 ||
    shouldApproveMembershipRequest(
      args.membershipRequest,
      args.grantRequestIds,
      args.approveMembership
    )
  );
}

async function notifyRelationshipRequestApproved(
  tx: Parameters<typeof can>[0],
  senderId: string,
  request: {
    group_a_id: string;
    group_b_id: string;
    initiator_group_id: string;
  }
) {
  const approverGroupId = getOtherConnectionGroupId(request, request.initiator_group_id);
  const [sourceGroupName, targetGroupName] = await Promise.all([
    groupName(tx, request.initiator_group_id),
    groupName(tx, approverGroupId),
  ]);

  fireNotification('notifyRelationshipApproved', {
    senderId,
    sourceGroupId: request.initiator_group_id,
    sourceGroupName,
    targetGroupId: approverGroupId,
    targetGroupName,
  });
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
      await assertCanDeleteConnectionFromActingGroup(tx, ctx, existing, args.acting_group_id);
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
      await notifyRelationshipRequestCreated(tx, ctx.userID, args);
    }
  ),

  approveGroupConnectionRequest: defineMutator(
    approveGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      const request = await tx.run(zql.group_connection_request.where('id', args.id).one());
      if (!request) {
        throw new Error('Group connection request not found');
      }
      await assertCanManageConnectionRequestCounterparty(tx, ctx, request);

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
        isGroupMembershipMode(membershipRequest.membership_mode)
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
      const approvedMembership =
        shouldApproveMembershipRequest(
          membershipRequest,
          args.grant_request_ids,
          args.approve_membership
        ) && requestedMembership
          ? requestedMembership
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
      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'group_connection_upsert',
        connection_id: request.active_connection_id ?? request.proposed_connection_id,
        group_a_id: request.group_a_id,
        group_b_id: request.group_b_id,
        connection_type: request.desired_connection_type,
        parent_group_id: request.desired_parent_group_id ?? null,
        child_group_id: request.desired_child_group_id ?? null,
        grants: getPendingGrantRequestsForApproval(grantRequests, args.grant_request_ids).map(
          (item: any) => ({
            id: item.existing_grant_id ?? item.id,
            right_key: item.right_key,
            holder_group_id: item.holder_group_id,
            scope_group_id: item.scope_group_id,
            status: 'active' as const,
            initiator_group_id: item.initiator_group_id ?? null,
          })
        ),
        membership_rule: approvedMembership,
      });
      const shouldNotifyApproval = shouldNotifyRelationshipApproval({
        request,
        grantRequests,
        membershipRequest,
        grantRequestIds: args.grant_request_ids,
        approveMembership: args.approve_membership,
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
      if (shouldNotifyApproval) {
        await notifyRelationshipRequestApproved(tx, ctx.userID, request);
      }
    }
  ),

  rejectGroupConnectionRequest: defineMutator(
    rejectGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      const existingRequest = await tx.run(zql.group_connection_request.where('id', args.id).one());
      if (!existingRequest) {
        throw new Error('Group connection request not found');
      }
      await assertCanManageConnectionRequestCounterparty(tx, ctx, existingRequest);

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
