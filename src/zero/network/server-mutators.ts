import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import {
  createNetworkLinkSchema,
  deleteNetworkLinkSchema,
  proposeNetworkLinkChangeSchema,
  approveNetworkLinkChangeRequestSchema,
  rejectNetworkLinkChangeRequestSchema,
  updateNetworkLinkSchema,
} from './schema';
import {
  buildGroupsById,
  reconcileHierarchyForBaseGroup,
  loadGroupWithDerivedNetworkMeta,
  recomputeSiblingGroupMemberships,
} from '../groups/membership-helpers';
import { reconcileDelegateAllocationsForGroups } from '../events/delegate-allocation-reconcile';
import { reconcileGeneralAssemblyParticipantsForGroups } from '../events/assembly-reconcile';
import { assertNoBlockingGroupConflicts } from '@/server/group-conflict-validation';
import {
  approveNetworkLinkChangeRequest as approveNetworkLinkChangeRequestInternal,
  deleteNetworkLinkAndRequests as deleteNetworkLinkAndRequestsInternal,
  proposeNetworkLinkChange as proposeNetworkLinkChangeInternal,
  rejectNetworkLinkChangeRequest as rejectNetworkLinkChangeRequestInternal,
} from './mutator-helpers';
import { normalizeMembershipRules, toLegacyMembershipRuleFields } from './membershipRules';

const GUEST_ONLY_SIBLING_MEMBERSHIP_MODES = new Set([
  'all_members',
  'role_members',
  'selected_source_groups',
]);

function buildConflictMembershipPayload(
  membershipRule:
    | {
        membership_direction?: 'forward' | 'backward' | null;
        membership_mode?: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
        role_id?: string | null;
        source_group_ids?: string[] | null;
      }
    | null
    | undefined
) {
  return {
    membership_rule: toLegacyMembershipRuleFields(normalizeMembershipRules(membershipRule)),
  };
}

function requiresGuestAccessFlow(group: {
  group_type?: string | null;
  primary_sibling_membership_mode?: string | null;
}) {
  const primarySiblingMembershipMode = group.primary_sibling_membership_mode;
  return (
    group.group_type === 'sibling' &&
    primarySiblingMembershipMode != null &&
    GUEST_ONLY_SIBLING_MEMBERSHIP_MODES.has(primarySiblingMembershipMode)
  );
}

async function reconcileGroupRoleDefaultsForMembershipMode(
  tx: Parameters<typeof mutators.network.createNetworkLink.fn>[0]['tx'],
  groupId: string
) {
  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
  if (!group) {
    return;
  }

  const roles = await tx.run(
    zql.role.where('group_id', groupId).where('scope', 'group').orderBy('sort_order', 'asc')
  );
  const memberRoles = roles.filter(role => role.assignee_kind !== 'guest');
  const guestRoles = roles.filter(role => role.assignee_kind === 'guest');
  const guestOnlyFlow = requiresGuestAccessFlow(group);
  const now = Date.now();

  if (guestOnlyFlow) {
    let preferredGuestRole =
      guestRoles.find(role => role.default_request_role || role.default_invite_role) ??
      guestRoles.find(role => role.name === 'Guest') ??
      guestRoles[0] ??
      null;

    if (!preferredGuestRole) {
      const guestRoleId = crypto.randomUUID();
      await tx.mutate.role.insert({
        id: guestRoleId,
        name: 'Guest',
        description: 'Default guest access role for sibling membership groups.',
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
      preferredGuestRole = {
        id: guestRoleId,
        assignee_kind: 'guest',
        default_request_role: true,
        default_invite_role: true,
      } as (typeof roles)[number];
    }

    for (const role of roles) {
      const shouldBeDefault = role.id === preferredGuestRole.id;
      if (
        role.default_request_role !== shouldBeDefault ||
        role.default_invite_role !== shouldBeDefault
      ) {
        await tx.mutate.role.update({
          id: role.id,
          default_request_role: shouldBeDefault,
          default_invite_role: shouldBeDefault,
        });
      }
    }

    return;
  }

  const memberDefaultRole =
    memberRoles.find(role => role.default_request_role || role.default_invite_role) ??
    memberRoles.find(role => role.name === 'Member') ??
    memberRoles[0] ??
    null;

  for (const guestRole of guestRoles) {
    if (guestRole.default_request_role || guestRole.default_invite_role) {
      await tx.mutate.role.update({
        id: guestRole.id,
        default_request_role: false,
        default_invite_role: false,
      });
    }
  }

  if (!memberDefaultRole) {
    return;
  }

  for (const memberRole of memberRoles) {
    const shouldBeDefault = memberRole.id === memberDefaultRole.id;
    if (
      memberRole.default_request_role !== shouldBeDefault ||
      memberRole.default_invite_role !== shouldBeDefault
    ) {
      await tx.mutate.role.update({
        id: memberRole.id,
        default_request_role: shouldBeDefault,
        default_invite_role: shouldBeDefault,
      });
    }
  }
}

async function reconcileNetworkSideEffects(
  tx: Parameters<typeof mutators.network.createNetworkLink.fn>[0]['tx'],
  assignedById: string,
  groupIds: readonly (string | null | undefined)[]
) {
  const affectedGroupIds = [
    ...new Set(groupIds.filter((groupId): groupId is string => Boolean(groupId))),
  ];
  if (affectedGroupIds.length === 0) {
    return;
  }

  const groupsById = await buildGroupsById(tx);
  const allGroups = [...groupsById.values()];
  const allGroupIds = allGroups.map(group => group.id);
  const baseGroupIds = allGroups
    .filter(group => group.group_type === 'base')
    .map(group => group.id);

  for (const baseGroupId of baseGroupIds) {
    await reconcileHierarchyForBaseGroup(tx, baseGroupId, assignedById);
  }

  for (const currentGroupId of allGroupIds) {
    await recomputeSiblingGroupMemberships(tx, currentGroupId, assignedById);
    await reconcileGroupRoleDefaultsForMembershipMode(tx, currentGroupId);
  }

  await reconcileGeneralAssemblyParticipantsForGroups(tx, allGroupIds, assignedById);
  await reconcileDelegateAllocationsForGroups(tx, allGroupIds);
}

export const networkServerMutators = {
  createNetworkLink: defineMutator(createNetworkLinkSchema, async ({ tx, ctx, args }) => {
    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'network_link_upsert',
      link_id: args.id,
      source_group_id: args.source_group_id,
      target_group_id: args.target_group_id,
      structural_relation: args.structural_relation,
      rights: args.rights.map(right => ({
        id: right.id,
        right_key: right.right_key,
        direction: right.direction,
        status: right.status,
        initiator_group_id: right.initiator_group_id ?? null,
      })),
      ...buildConflictMembershipPayload(args.membership_rule),
    });

    await mutators.network.createNetworkLink.fn({ tx, ctx, args });
    await reconcileNetworkSideEffects(tx, ctx.userID, [args.source_group_id, args.target_group_id]);
  }),

  updateNetworkLink: defineMutator(updateNetworkLinkSchema, async ({ tx, ctx, args }) => {
    const existingLink = await tx.run(zql.network_link.where('id', args.id).one());
    if (!existingLink) {
      await mutators.network.updateNetworkLink.fn({ tx, ctx, args });
      return;
    }

    const existingRights = await tx.run(zql.network_link_right.where('network_link_id', args.id));
    const nextRights =
      args.rights?.map(right => ({
        id: right.id,
        right_key: right.right_key,
        direction: right.direction,
        status: right.status,
        initiator_group_id: right.initiator_group_id ?? null,
      })) ??
      existingRights.map(right => ({
        id: right.id,
        right_key: right.right_key,
        direction: right.direction as 'forward' | 'backward' | 'bidirectional',
        status: right.status,
        initiator_group_id: right.initiator_group_id ?? null,
      }));

    await assertNoBlockingGroupConflicts(tx, ctx, {
      kind: 'network_link_upsert',
      link_id: args.id,
      source_group_id: args.source_group_id ?? existingLink.source_group_id,
      target_group_id: args.target_group_id ?? existingLink.target_group_id,
      structural_relation: (args.structural_relation ?? existingLink.structural_relation) as
        | 'parent_child'
        | 'sibling',
      rights: nextRights.map(right => ({
        id: right.id,
        right_key: right.right_key as
          | 'informationRight'
          | 'amendmentRight'
          | 'rightToSpeak'
          | 'activeVotingRight'
          | 'passiveVotingRight',
        direction: right.direction as 'forward' | 'backward' | 'bidirectional',
        status: right.status as 'active' | 'requested' | 'pending' | 'rejected',
        initiator_group_id: right.initiator_group_id ?? null,
      })),
      ...buildConflictMembershipPayload(
        (args.membership_rule ??
          (await tx.run(
            zql.network_link_membership_rule.where('network_link_id', args.id).one()
          ))) as
          | {
              membership_direction?: 'forward' | 'backward' | null;
              membership_mode?: 'none' | 'all_members' | 'role_members' | 'selected_source_groups';
              role_id?: string | null;
              source_group_ids?: string[] | null;
            }
          | undefined
      ),
    });

    await mutators.network.updateNetworkLink.fn({ tx, ctx, args });
    await reconcileNetworkSideEffects(tx, ctx.userID, [
      existingLink.source_group_id,
      existingLink.target_group_id,
      args.source_group_id ?? null,
      args.target_group_id ?? null,
    ]);
  }),

  deleteNetworkLink: defineMutator(deleteNetworkLinkSchema, async ({ tx, ctx, args }) => {
    const existingLink = await tx.run(zql.network_link.where('id', args.id).one());
    await deleteNetworkLinkAndRequestsInternal(tx, args.id);

    if (!existingLink) {
      return;
    }

    await reconcileNetworkSideEffects(tx, ctx.userID, [
      existingLink.source_group_id,
      existingLink.target_group_id,
    ]);
  }),

  proposeNetworkLinkChange: defineMutator(
    proposeNetworkLinkChangeSchema,
    async ({ tx, ctx, args }) => {
      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'network_link_upsert',
        link_id: args.active_network_link_id ?? args.proposed_network_link_id,
        source_group_id: args.source_group_id,
        target_group_id: args.target_group_id,
        structural_relation: args.structural_relation,
        rights: args.desired_rights.map(right => ({
          id: right.id,
          right_key: right.right_key,
          direction: right.direction,
          status: 'active',
          initiator_group_id: args.initiator_group_id,
        })),
        ...buildConflictMembershipPayload({
          membership_direction: args.desired_membership_direction ?? null,
          membership_mode: args.desired_membership_mode,
          role_id: args.desired_role_id ?? null,
          source_group_ids: args.desired_source_group_ids ?? null,
        }),
      });

      const existingLink = args.active_network_link_id
        ? await tx.run(zql.network_link.where('id', args.active_network_link_id).one())
        : null;
      await proposeNetworkLinkChangeInternal(tx, args);
      await reconcileNetworkSideEffects(tx, ctx.userID, [
        existingLink?.source_group_id ?? null,
        existingLink?.target_group_id ?? null,
      ]);
    }
  ),

  approveNetworkLinkChangeRequest: defineMutator(
    approveNetworkLinkChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      const request = await tx.run(zql.network_link_change_request.where('id', args.id).one());
      if (!request) {
        const missingRequest = await approveNetworkLinkChangeRequestInternal(
          tx,
          args.id,
          args.right_ids
        );
        await reconcileNetworkSideEffects(tx, ctx.userID, [
          missingRequest.active_network_link_id ?? null,
          missingRequest.source_group_id,
          missingRequest.target_group_id,
        ]);
        return;
      }

      const requestedRightIds = args.right_ids ? new Set(args.right_ids) : null;
      const approvedRights = (request.desired_rights ?? []).filter(
        desiredRight => requestedRightIds == null || requestedRightIds.has(desiredRight.id)
      );

      await assertNoBlockingGroupConflicts(tx, ctx, {
        kind: 'network_link_upsert',
        link_id: request.active_network_link_id ?? request.proposed_network_link_id,
        source_group_id: request.source_group_id,
        target_group_id: request.target_group_id,
        structural_relation: request.structural_relation as 'parent_child' | 'sibling',
        rights: approvedRights.map(right => ({
          id: right.id,
          right_key: right.right_key,
          direction: right.direction,
          status: 'active',
          initiator_group_id: request.initiator_group_id,
        })),
        ...buildConflictMembershipPayload({
          membership_direction: (request.desired_membership_direction ?? null) as
            | 'forward'
            | 'backward'
            | null,
          membership_mode: request.desired_membership_mode as
            | 'none'
            | 'all_members'
            | 'role_members'
            | 'selected_source_groups',
          role_id: request.desired_role_id ?? null,
          source_group_ids: request.desired_source_group_ids ?? null,
        }),
      });

      const approvedRequest = await approveNetworkLinkChangeRequestInternal(
        tx,
        args.id,
        args.right_ids
      );
      await reconcileNetworkSideEffects(tx, ctx.userID, [
        approvedRequest.active_network_link_id ?? null,
        approvedRequest.source_group_id,
        approvedRequest.target_group_id,
      ]);
    }
  ),

  rejectNetworkLinkChangeRequest: defineMutator(
    rejectNetworkLinkChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      const request = await rejectNetworkLinkChangeRequestInternal(tx, args.id, args.right_ids);
      await reconcileNetworkSideEffects(tx, ctx.userID, [
        request.active_network_link_id ?? null,
        request.source_group_id,
        request.target_group_id,
      ]);
    }
  ),
};
