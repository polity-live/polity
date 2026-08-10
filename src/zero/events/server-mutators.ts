import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { amendmentServerMutators } from '../amendments/server-mutators';
import { syncEntityHashtagsForCreate } from '../common/server-hashtags';
import {
  eventTitle,
  groupName,
  userName,
  isActiveEventStatus,
  isActiveGroupStatus,
  ensureEventConversation,
  recomputeEventCounters,
  recomputeGroupCounters,
  syncUserWithEventConversation,
} from '../server-helpers';
import { DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE, DEFAULT_EVENT_ROLES } from '../rbac/constants';
import {
  eventCreateSchema,
  eventParticipantCreateSchema,
  eventParticipantDeleteSchema,
  eventParticipantUpdateSchema,
  eventOfflineParticipantCreateSchema,
  eventOfflineParticipantUpdateSchema,
  eventOfflineParticipantDeleteSchema,
  eventOfflineParticipantBulkImportSchema,
  eventParticipantRoleAssignSchema,
  eventParticipantRoleUnassignSchema,
  eventParticipantRolesSyncSchema,
  eventUpdateSchema,
  eventCancelSchema,
  eventFullCreateMutatorSchema,
  createEventRoleSchema,
  deleteEventRoleSchema,
  bookMeetingSchema,
  cancelMeetingBookingSchema,
} from './schema';
import { reconcileGeneralAssemblyParticipantsForEvent } from './assembly-reconcile';
import { reconcileDelegateAllocationsForEvent } from './delegate-allocation-reconcile';
import { reconcileGroupGraph } from '../network/group-graph-reconcile';
import { loadGroupWithDerivedNetworkMeta } from '../groups/membership-helpers';
import {
  canCreateDelegateAssemblyForGroup,
  DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE,
} from '@/features/events/logic/delegateAssemblyEligibility';
import { normalizeChangeRequestVoteOrder } from '@/features/change-requests/logic/changeRequestVoteOrder';
import { reorderOpenChangeRequestVoteStepsForEvent } from '../agendas/change-request-vote-ordering';
import {
  ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE,
  hasOpenElectorateSnapshot,
  resolveEventAttendanceMode,
} from './attendance-mode';

async function addEventParticipantRoleLink(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  args: {
    event_participant_id: string;
    role_id: string;
    assigned_by_id?: string | null;
  }
) {
  const existingLink = await tx.run(
    zql.event_participant_role
      .where('event_participant_id', args.event_participant_id)
      .where('role_id', args.role_id)
      .one()
  );

  if (existingLink) {
    return existingLink.id;
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  await tx.mutate.event_participant_role.insert({
    id,
    event_participant_id: args.event_participant_id,
    role_id: args.role_id,
    assigned_at: now,
    assigned_by_id: args.assigned_by_id ?? null,
    created_at: now,
  });

  return id;
}

async function syncEventParticipantRoleLinks(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  args: {
    event_participant_id: string;
    role_ids: string[];
    assigned_by_id?: string | null;
  }
) {
  const desiredRoleIds = [...new Set(args.role_ids.filter(Boolean))];
  const existingLinks = await tx.run(
    zql.event_participant_role.where('event_participant_id', args.event_participant_id)
  );
  const desiredRoleIdSet = new Set(desiredRoleIds);
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.event_participant_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addEventParticipantRoleLink(tx, {
        event_participant_id: args.event_participant_id,
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

async function eventParticipantRoleIds(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  participantId: string
) {
  const links = await tx.run(
    zql.event_participant_role.where('event_participant_id', participantId)
  );
  return links.map(link => link.role_id).filter(Boolean);
}

async function eventRolesWithRights(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  roleIds: readonly string[]
) {
  return Promise.all(
    roleIds.map(roleId => tx.run(zql.role.where('id', roleId).related('action_rights').one()))
  );
}

function isOrganizerLikeRole(
  role:
    | {
        name?: string | null;
        action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
      }
    | null
    | undefined
) {
  if (!role) return false;
  if (role.name === 'Organizer' || role.name === 'Admin') return true;
  return (role.action_rights ?? []).some(
    right =>
      (right.resource === 'events' &&
        (right.action === 'manage' || right.action === 'manage_participants')) ||
      (right.resource === 'notifications' && right.action === 'manageNotifications')
  );
}

async function eventRoleSummary(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  roleIds: readonly string[],
  fallback = 'Participant'
) {
  if (roleIds.length === 0) return fallback;
  const roles = await eventRolesWithRights(tx, roleIds);
  return roles.map(role => role?.name ?? 'Role').join(', ');
}

async function hasOrganizerLikeRole(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  roleIds: readonly string[]
) {
  const roles = await eventRolesWithRights(tx, roleIds);
  return roles.some(isOrganizerLikeRole);
}

async function notifyActiveEventParticipantRoleChange(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  actorUserId: string,
  participant: { id: string; event_id: string; user_id: string; status?: string | null },
  previousRoleIds: readonly string[]
) {
  if (!isActiveEventStatus(participant.status)) return;

  const nextRoleIds = await eventParticipantRoleIds(tx, participant.id);
  if (sameStringSet(previousRoleIds, nextRoleIds)) return;

  const [eTitle, wasOrganizer, isOrganizer, newRole] = await Promise.all([
    eventTitle(tx, participant.event_id),
    hasOrganizerLikeRole(tx, previousRoleIds),
    hasOrganizerLikeRole(tx, nextRoleIds),
    eventRoleSummary(tx, nextRoleIds),
  ]);

  if (!wasOrganizer && isOrganizer) {
    fireNotification('notifyOrganizerPromoted', {
      senderId: actorUserId,
      recipientUserId: participant.user_id,
      eventId: participant.event_id,
      eventTitle: eTitle,
    });
    return;
  }

  if (wasOrganizer && !isOrganizer) {
    fireNotification('notifyOrganizerDemoted', {
      senderId: actorUserId,
      recipientUserId: participant.user_id,
      eventId: participant.event_id,
      eventTitle: eTitle,
    });
    return;
  }

  fireNotification('notifyParticipationRoleChanged', {
    senderId: actorUserId,
    recipientUserId: participant.user_id,
    eventId: participant.event_id,
    eventTitle: eTitle,
    newRole,
  });
}

async function isConfirmedDelegateForEvent(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  eventId: string,
  userId: string
) {
  const delegates = await tx.run(
    zql.event_delegate.where('event_id', eventId).where('user_id', userId)
  );
  return delegates.some(delegate => delegate.status === 'confirmed');
}

async function isActiveMemberOfGroup(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  groupId: string,
  userId: string
) {
  const memberships = await tx.run(
    zql.group_membership.where('group_id', groupId).where('user_id', userId)
  );
  return memberships.some(membership => isActiveGroupStatus(membership.status));
}

async function assertEventParticipationEligibility(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  args: {
    event_id: string;
    user_id: string;
    allowInviteOnlyEvent: boolean;
    allowAssemblyGuestInvite?: boolean;
  }
) {
  const event = await tx.run(zql.event.where('id', args.event_id).one());

  if (!event) {
    throw new Error('Event not found.');
  }

  if (event.event_type === 'delegate_assembly') {
    if (args.allowAssemblyGuestInvite) {
      return event;
    }

    const isConfirmedDelegate = await isConfirmedDelegateForEvent(tx, args.event_id, args.user_id);
    if (!isConfirmedDelegate) {
      throw new Error('Only confirmed delegates can participate in this delegate assembly.');
    }
  }

  if (event.event_type === 'general_assembly') {
    if (args.allowAssemblyGuestInvite) {
      return event;
    }

    if (!event.group_id) {
      throw new Error('This general assembly is missing its associated group.');
    }

    const isGroupMember = await isActiveMemberOfGroup(tx, event.group_id, args.user_id);
    if (!isGroupMember) {
      throw new Error(
        'Only active members of the associated group can participate in this general assembly.'
      );
    }
  }

  if (event.event_type === 'on_invite' && !args.allowInviteOnlyEvent) {
    throw new Error('This event is by invitation only.');
  }

  return event;
}

async function isGuestInviteForEvent(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  args: {
    event_id: string;
    initial_role_id?: string | null;
    initial_role_ids?: string[];
  }
) {
  const explicitRoleIds = [...new Set((args.initial_role_ids ?? []).filter(Boolean))];

  if (args.initial_role_id && explicitRoleIds.length === 0) {
    explicitRoleIds.push(args.initial_role_id);
  }

  const roles = explicitRoleIds.length
    ? await tx.run(zql.role.where('event_id', args.event_id).where('scope', 'event'))
    : await tx.run(
        zql.role
          .where('event_id', args.event_id)
          .where('scope', 'event')
          .where('default_invite_role', true)
      );

  const candidateRoles = explicitRoleIds.length
    ? roles.filter(role => explicitRoleIds.includes(role.id))
    : roles;

  return candidateRoles.length > 0 && candidateRoles.every(role => role.assignee_kind === 'guest');
}

function isAssemblyEventType(eventType: string | null | undefined) {
  return eventType === 'general_assembly' || eventType === 'delegate_assembly';
}

async function normalizeOfflineParticipantChannelsForEvent(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  eventId: string
) {
  const event = await tx.run(zql.event.where('id', eventId).one());
  if (!event) {
    return;
  }

  const attendanceMode = resolveEventAttendanceMode(event);
  const offlineParticipants = await tx.run(
    zql.event_offline_participant.where('event_id', eventId)
  );

  for (const offlineParticipant of offlineParticipants) {
    const nextParticipationChannel =
      attendanceMode === 'offline'
        ? 'offline'
        : attendanceMode === 'hybrid'
          ? offlineParticipant.connected_user_id &&
            offlineParticipant.participation_channel !== 'offline'
            ? 'online'
            : 'offline'
          : offlineParticipant.connected_user_id
            ? 'online'
            : offlineParticipant.participation_channel;

    if (nextParticipationChannel !== offlineParticipant.participation_channel) {
      await tx.mutate.event_offline_participant.update({
        id: offlineParticipant.id,
        participation_channel: nextParticipationChannel,
        updated_at: Date.now(),
      });
    }
  }
}

async function assertAttendanceModeCanChange(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  eventId: string
) {
  const agendaItems = await tx.run(zql.agenda_item.where('event_id', eventId));

  for (const agendaItem of agendaItems) {
    const [votes, elections] = await Promise.all([
      tx.run(zql.vote.where('agenda_item_id', agendaItem.id)),
      tx.run(zql.election.where('agenda_item_id', agendaItem.id)),
    ]);
    if (hasOpenElectorateSnapshot(votes) || hasOpenElectorateSnapshot(elections)) {
      throw new Error(ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE);
    }
  }
}

async function assertDelegateAssemblyGroupEligibility(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  groupId: string | null | undefined
) {
  if (!groupId) {
    throw new Error('Delegate assemblies must be linked to a group.');
  }

  const group = await loadGroupWithDerivedNetworkMeta(tx, groupId);
  if (!group) {
    throw new Error('Associated group not found.');
  }

  if (!canCreateDelegateAssemblyForGroup(group)) {
    throw new Error(DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE);
  }
}

async function assertEventStatusTransitionEligibility(
  tx: Parameters<typeof mutators.events.create.fn>[0]['tx'],
  args: {
    event_id: string;
    user_id: string;
    old_status: string | null | undefined;
    new_status: string | null | undefined;
  }
) {
  const becameActive =
    args.new_status !== undefined &&
    isActiveEventStatus(args.new_status) &&
    !isActiveEventStatus(args.old_status);

  if (!becameActive) {
    return;
  }

  await assertEventParticipationEligibility(tx, {
    event_id: args.event_id,
    user_id: args.user_id,
    allowInviteOnlyEvent: args.old_status === 'invited',
  });
}

export const eventServerMutatorInternals = {
  addEventParticipantRoleLink,
  syncEventParticipantRoleLinks,
  sameStringSet,
  eventParticipantRoleIds,
  eventRolesWithRights,
  isOrganizerLikeRole,
  eventRoleSummary,
  hasOrganizerLikeRole,
  notifyActiveEventParticipantRoleChange,
  isConfirmedDelegateForEvent,
  isActiveMemberOfGroup,
  assertEventParticipationEligibility,
  isGuestInviteForEvent,
  isAssemblyEventType,
  normalizeOfflineParticipantChannelsForEvent,
  assertAttendanceModeCanChange,
  assertDelegateAssemblyGroupEligibility,
  assertEventStatusTransitionEligibility,
};

/** Server-only mutators — override the shared mutators with additional server-side logic (e.g. notifications). */
export const eventServerMutators = {
  create: defineMutator(eventCreateSchema, async ({ tx, ctx, args }) => {
    if (args.event_type === 'delegate_assembly') {
      await assertDelegateAssemblyGroupEligibility(tx, args.group_id);
    }

    await mutators.events.create.fn({ tx, ctx, args });

    const now = Date.now();

    const eventRoleTemplates = isAssemblyEventType(args.event_type)
      ? [
          ...DEFAULT_EVENT_ROLES.map(role => ({
            ...role,
            default_request_role: false,
            default_invite_role: false,
          })),
          DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE,
        ]
      : DEFAULT_EVENT_ROLES;

    // Create default event roles with action rights
    const organizerRoleId = crypto.randomUUID();
    const roleIds: Record<string, string> = {};
    const totalRoles = eventRoleTemplates.length;

    for (let index = 0; index < totalRoles; index++) {
      const roleDef = eventRoleTemplates[index];
      const roleId = roleDef.name === 'Organizer' ? organizerRoleId : crypto.randomUUID();
      roleIds[roleDef.name] = roleId;

      await tx.mutate.role.insert({
        id: roleId,
        name: roleDef.name,
        description: roleDef.description,
        scope: 'event',
        event_id: args.id,
        group_id: null,
        amendment_id: null,
        blog_id: null,
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: roleDef.default_request_role ?? false,
        default_invite_role: roleDef.default_invite_role ?? false,
        assignee_kind: roleDef.assignee_kind ?? 'member',
        sort_order: totalRoles - 1 - index,
        created_at: now,
      });

      for (const perm of roleDef.permissions) {
        await tx.mutate.action_right.insert({
          id: crypto.randomUUID(),
          resource: perm.resource,
          action: perm.action,
          role_id: roleId,
          event_id: args.id,
          group_id: null,
          amendment_id: null,
          blog_id: null,
          created_at: now,
        });
      }
    }

    const defaultInviteRole = eventRoleTemplates.find(roleDef => roleDef.default_invite_role);
    const defaultInviteRoleId = defaultInviteRole
      ? roleIds[defaultInviteRole.name]
      : (roleIds.Participant ?? null);

    const creatorParticipation = await tx.run(
      zql.event_participant.where('event_id', args.id).where('user_id', ctx.userID).one()
    );
    if (creatorParticipation) {
      await tx.mutate.event_participant.update({
        id: creatorParticipation.id,
        group_id: args.group_id ?? null,
        status: 'active',
        visibility: args.visibility ?? 'public',
      });

      await syncEventParticipantRoleLinks(tx, {
        event_participant_id: creatorParticipation.id,
        role_ids: [organizerRoleId],
        assigned_by_id: ctx.userID,
      });
    } else {
      const creatorParticipationId = crypto.randomUUID();

      await tx.mutate.event_participant.insert({
        id: creatorParticipationId,
        event_id: args.id,
        user_id: ctx.userID,
        group_id: args.group_id ?? null,
        status: 'active',
        visibility: args.visibility ?? 'public',
        instance_date: null,
        created_at: now,
      });

      await syncEventParticipantRoleLinks(tx, {
        event_participant_id: creatorParticipationId,
        role_ids: [organizerRoleId],
        assigned_by_id: ctx.userID,
      });
    }

    await ensureEventConversation(tx, {
      eventId: args.id,
      name: args.title,
      requestedById: ctx.userID,
      createdAt: now,
    });
    await syncUserWithEventConversation(tx, {
      eventId: args.id,
      userId: ctx.userID,
    });

    // Auto-invite group members for General Assembly events
    if (args.event_type === 'general_assembly' && args.group_id) {
      await reconcileGeneralAssemblyParticipantsForEvent(tx, args.id, ctx.userID);
    }

    if (args.event_type === 'delegate_assembly') {
      await reconcileDelegateAllocationsForEvent(tx, args.id);
    }

    if (isAssemblyEventType(args.event_type)) {
      await reconcileGroupGraph(tx, {
        groupIds: [args.group_id],
        eventIds: [args.id],
        assignedById: ctx.userID,
        reason: 'event-create',
      });
    }

    // Auto-invite specific users for OnInvite events
    if (args.event_type === 'on_invite' && args.invited_user_ids?.length) {
      for (const userId of args.invited_user_ids) {
        if (userId === ctx.userID) continue; // skip creator (already added)
        const participationId = crypto.randomUUID();
        await tx.mutate.event_participant.insert({
          id: participationId,
          event_id: args.id,
          user_id: userId,
          group_id: args.group_id ?? null,
          status: 'invited',
          visibility: args.visibility ?? 'public',
          created_at: now,
        });

        if (defaultInviteRoleId) {
          await syncEventParticipantRoleLinks(tx, {
            event_participant_id: participationId,
            role_ids: [defaultInviteRoleId],
            assigned_by_id: ctx.userID,
          });
        }
      }
    }

    await recomputeEventCounters(tx, args.id);

    if (args.group_id) {
      await recomputeGroupCounters(tx, args.group_id);
      fireNotification('notifyGroupEventAssigned', {
        senderId: ctx.userID,
        groupId: args.group_id,
        groupName: await groupName(tx, args.group_id),
        eventId: args.id,
        eventTitle: args.title,
      });
    }
  }),

  createFull: defineMutator(eventFullCreateMutatorSchema, async ({ tx, ctx, args }) => {
    await eventServerMutators.create.fn({ tx, ctx, args: args.event });
    await syncEntityHashtagsForCreate(tx, ctx, 'event', args.event.id, args.hashtags);

    for (const completion of args.process_task_completions ?? []) {
      await amendmentServerMutators.completeProcessTaskWithEvent.fn({
        tx,
        ctx,
        args: completion,
      });
    }
  }),

  createOfflineParticipant: defineMutator(
    eventOfflineParticipantCreateSchema,
    async ({ tx, ctx, args }) => {
      await mutators.events.createOfflineParticipant.fn({ tx, ctx, args });
      await recomputeEventCounters(tx, args.event_id);
    }
  ),

  updateOfflineParticipant: defineMutator(
    eventOfflineParticipantUpdateSchema,
    async ({ tx, ctx, args }) => {
      const existingOfflineParticipant = await tx.run(
        zql.event_offline_participant.where('id', args.id).one()
      );

      await mutators.events.updateOfflineParticipant.fn({ tx, ctx, args });

      if (!existingOfflineParticipant) {
        return;
      }

      await recomputeEventCounters(tx, existingOfflineParticipant.event_id);
    }
  ),

  deleteOfflineParticipant: defineMutator(
    eventOfflineParticipantDeleteSchema,
    async ({ tx, ctx, args }) => {
      const existingOfflineParticipant = await tx.run(
        zql.event_offline_participant.where('id', args.id).one()
      );

      await mutators.events.deleteOfflineParticipant.fn({ tx, ctx, args });

      if (!existingOfflineParticipant) {
        return;
      }

      await recomputeEventCounters(tx, existingOfflineParticipant.event_id);
    }
  ),

  importOfflineParticipants: defineMutator(
    eventOfflineParticipantBulkImportSchema,
    async ({ tx, ctx, args }) => {
      await mutators.events.importOfflineParticipants.fn({ tx, ctx, args });
      await recomputeEventCounters(tx, args.event_id);
    }
  ),

  joinEvent: defineMutator(eventParticipantCreateSchema, async ({ tx, ctx, args }) => {
    await assertEventParticipationEligibility(tx, {
      event_id: args.event_id,
      user_id: ctx.userID,
      allowInviteOnlyEvent: false,
    });

    await mutators.events.joinEvent.fn({ tx, ctx, args });

    await recomputeEventCounters(tx, args.event_id);

    if (isActiveEventStatus(args.status)) {
      await syncUserWithEventConversation(tx, {
        eventId: args.event_id,
        userId: ctx.userID,
      });
    }

    if (args.status === 'requested' && args.event_id) {
      const [eTitle, uName] = await Promise.all([
        eventTitle(tx, args.event_id),
        userName(tx, ctx.userID),
      ]);
      fireNotification('notifyParticipationRequest', {
        senderId: ctx.userID,
        senderName: uName,
        eventId: args.event_id,
        eventTitle: eTitle,
      });
    }
  }),

  inviteParticipant: defineMutator(eventParticipantCreateSchema, async ({ tx, ctx, args }) => {
    if (args.user_id) {
      const allowAssemblyGuestInvite = await isGuestInviteForEvent(tx, {
        event_id: args.event_id,
        initial_role_id: args.initial_role_id,
        initial_role_ids: args.initial_role_ids,
      });

      await assertEventParticipationEligibility(tx, {
        event_id: args.event_id,
        user_id: args.user_id,
        allowInviteOnlyEvent: true,
        allowAssemblyGuestInvite,
      });
    }

    await mutators.events.inviteParticipant.fn({ tx, ctx, args });

    await recomputeEventCounters(tx, args.event_id);

    if (args.user_id && args.event_id) {
      const eTitle = await eventTitle(tx, args.event_id);
      fireNotification('notifyEventInvite', {
        senderId: ctx.userID,
        recipientUserId: args.user_id,
        eventId: args.event_id,
        eventTitle: eTitle,
      });
    }
  }),

  leaveEvent: defineMutator(eventParticipantDeleteSchema, async ({ tx, ctx, args }) => {
    const participation = await tx.run(zql.event_participant.where('id', args.id).one());

    await mutators.events.leaveEvent.fn({ tx, ctx, args });

    if (!participation) return;

    await recomputeEventCounters(tx, participation.event_id);
    await syncUserWithEventConversation(tx, {
      eventId: participation.event_id,
      userId: participation.user_id,
    });

    const eId = participation.event_id;
    const partUserId = participation.user_id;
    const status = participation.status;
    const isSelf = ctx.userID === partUserId;

    const [eTitle, uName] = await Promise.all([eventTitle(tx, eId), userName(tx, partUserId)]);

    if (isSelf) {
      if (status === 'requested') {
        fireNotification('notifyEventRequestWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          eventId: eId,
          eventTitle: eTitle,
        });
      } else if (status === 'invited') {
        fireNotification('notifyEventInvitationDeclined', {
          senderId: ctx.userID,
          senderName: uName,
          eventId: eId,
          eventTitle: eTitle,
        });
      } else {
        fireNotification('notifyParticipationWithdrawn', {
          senderId: ctx.userID,
          senderName: uName,
          eventId: eId,
          eventTitle: eTitle,
        });
      }
    } else {
      if (status === 'requested') {
        fireNotification('notifyParticipationRejected', {
          senderId: ctx.userID,
          recipientUserId: partUserId,
          eventId: eId,
          eventTitle: eTitle,
        });
      } else {
        fireNotification('notifyParticipationRemoved', {
          senderId: ctx.userID,
          recipientUserId: partUserId,
          eventId: eId,
          eventTitle: eTitle,
        });
      }
    }
  }),

  updateParticipant: defineMutator(eventParticipantUpdateSchema, async ({ tx, ctx, args }) => {
    const oldPart = await tx.run(zql.event_participant.where('id', args.id).one());

    if (oldPart) {
      await assertEventStatusTransitionEligibility(tx, {
        event_id: oldPart.event_id,
        user_id: oldPart.user_id,
        old_status: oldPart.status,
        new_status: args.status,
      });
    }

    await mutators.events.updateParticipant.fn({ tx, ctx, args });

    if (!oldPart) return;

    await recomputeEventCounters(tx, oldPart.event_id);

    if (args.status !== undefined) {
      await syncUserWithEventConversation(tx, {
        eventId: oldPart.event_id,
        userId: oldPart.user_id,
      });
    }

    const eId = oldPart.event_id;
    const partUserId = oldPart.user_id;
    const oldStatus = oldPart.status;
    const newStatus = args.status;
    const isSelf = ctx.userID === partUserId;

    const eTitle = await eventTitle(tx, eId);

    if (newStatus === 'active' && (oldStatus === 'requested' || oldStatus === 'invited')) {
      if (isSelf) {
        const uName = await userName(tx, ctx.userID);
        fireNotification('notifyEventInvitationAccepted', {
          senderId: ctx.userID,
          senderName: uName,
          eventId: eId,
          eventTitle: eTitle,
        });
      } else {
        fireNotification('notifyParticipationApproved', {
          senderId: ctx.userID,
          recipientUserId: partUserId,
          eventId: eId,
          eventTitle: eTitle,
        });
      }
    }
  }),

  addParticipantRole: defineMutator(eventParticipantRoleAssignSchema, async ({ tx, ctx, args }) => {
    const participant = await tx.run(
      zql.event_participant.where('id', args.event_participant_id).one()
    );
    const previousRoleIds = participant
      ? await eventParticipantRoleIds(tx, args.event_participant_id)
      : [];

    await mutators.events.addParticipantRole.fn({ tx, ctx, args });

    if (!participant) return;
    await notifyActiveEventParticipantRoleChange(tx, ctx.userID, participant, previousRoleIds);
  }),

  removeParticipantRole: defineMutator(
    eventParticipantRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      const participant = await tx.run(
        zql.event_participant.where('id', args.event_participant_id).one()
      );
      const previousRoleIds = participant
        ? await eventParticipantRoleIds(tx, args.event_participant_id)
        : [];

      await mutators.events.removeParticipantRole.fn({ tx, ctx, args });

      if (!participant) return;
      await notifyActiveEventParticipantRoleChange(tx, ctx.userID, participant, previousRoleIds);
    }
  ),

  syncParticipantRoles: defineMutator(
    eventParticipantRolesSyncSchema,
    async ({ tx, ctx, args }) => {
      const participant = await tx.run(
        zql.event_participant.where('id', args.event_participant_id).one()
      );
      const previousRoleIds = participant
        ? await eventParticipantRoleIds(tx, args.event_participant_id)
        : [];

      await mutators.events.syncParticipantRoles.fn({ tx, ctx, args });

      if (!participant) return;
      await notifyActiveEventParticipantRoleChange(tx, ctx.userID, participant, previousRoleIds);
    }
  ),

  update: defineMutator(eventUpdateSchema, async ({ tx, ctx, args }) => {
    const previousEvent = await tx.run(zql.event.where('id', args.id).one());
    if (
      args.accreditation_required !== undefined &&
      previousEvent &&
      args.accreditation_required !== previousEvent.accreditation_required
    ) {
      const agendaItems = await tx.run(zql.agenda_item.where('event_id', args.id));
      for (const agendaItem of agendaItems) {
        const [votes, elections] = await Promise.all([
          tx.run(zql.vote.where('agenda_item_id', agendaItem.id)),
          tx.run(zql.election.where('agenda_item_id', agendaItem.id)),
        ]);
        const snapshottedVote = votes.some(vote => vote.electorate_snapshotted_at != null);
        const snapshottedElection = elections.some(
          election => election.electorate_snapshotted_at != null
        );
        if (snapshottedVote || snapshottedElection) {
          throw new Error(
            'Accreditation requirements cannot be changed after the first final ballot snapshot.'
          );
        }
      }
    }
    const nextEventType = args.event_type ?? previousEvent?.event_type ?? null;
    const nextGroupId =
      args.group_id !== undefined ? args.group_id : (previousEvent?.group_id ?? null);
    const assignedGroupId =
      previousEvent && args.group_id && args.group_id !== previousEvent.group_id
        ? args.group_id
        : null;
    const nextAttendanceMode = resolveEventAttendanceMode({
      attendance_mode: args.attendance_mode ?? previousEvent?.attendance_mode,
      location_type: args.location_type ?? previousEvent?.location_type,
    });
    const attendanceModeChanged =
      nextAttendanceMode !==
      resolveEventAttendanceMode({
        attendance_mode: previousEvent?.attendance_mode,
        location_type: previousEvent?.location_type,
      });
    const previousChangeRequestVoteOrder = normalizeChangeRequestVoteOrder(
      previousEvent?.change_request_vote_order
    );
    const nextChangeRequestVoteOrder = normalizeChangeRequestVoteOrder(
      args.change_request_vote_order ?? previousEvent?.change_request_vote_order
    );
    const changeRequestVoteOrderChanged =
      args.change_request_vote_order !== undefined &&
      nextChangeRequestVoteOrder !== previousChangeRequestVoteOrder;

    if (previousEvent && attendanceModeChanged) {
      await assertAttendanceModeCanChange(tx, args.id);
    }

    if (nextEventType === 'delegate_assembly') {
      await assertDelegateAssemblyGroupEligibility(tx, nextGroupId);
    }

    await mutators.events.update.fn({ tx, ctx, args });

    if (changeRequestVoteOrderChanged) {
      await reorderOpenChangeRequestVoteStepsForEvent(tx, args.id, nextChangeRequestVoteOrder);
    }

    if (args.title !== undefined && previousEvent?.title !== args.title) {
      const eventConversation = await tx.run(
        zql.conversation.where('event_id', args.id).where('type', 'event').one()
      );

      if (eventConversation) {
        await tx.mutate.conversation.update({
          id: eventConversation.id,
          name: args.title?.trim() || null,
        });
      }
    }

    const eTitle = await eventTitle(tx, args.id);
    fireNotification('notifyScheduleChanged', {
      senderId: ctx.userID,
      eventId: args.id,
      eventTitle: eTitle,
    });

    if (assignedGroupId) {
      fireNotification('notifyGroupEventAssigned', {
        senderId: ctx.userID,
        groupId: assignedGroupId,
        groupName: await groupName(tx, assignedGroupId),
        eventId: args.id,
        eventTitle: eTitle,
      });
    }

    if (attendanceModeChanged) {
      await normalizeOfflineParticipantChannelsForEvent(tx, args.id);
    }

    if (nextEventType === 'general_assembly') {
      await reconcileGeneralAssemblyParticipantsForEvent(tx, args.id, ctx.userID);
    }

    if (nextEventType === 'delegate_assembly') {
      await reconcileDelegateAllocationsForEvent(tx, args.id);
    }

    if (isAssemblyEventType(nextEventType)) {
      await reconcileGroupGraph(tx, {
        groupIds: [nextGroupId],
        eventIds: [args.id],
        assignedById: ctx.userID,
        reason: 'event-update',
      });
    }
  }),

  cancel: defineMutator(eventCancelSchema, async ({ tx, ctx, args }) => {
    const eTitle = await eventTitle(tx, args.id);

    // Read event before cancel to get group_id
    const ev = await tx.run(zql.event.where('id', args.id).one());

    await mutators.events.cancel.fn({ tx, ctx, args });

    if (ev?.group_id) {
      await recomputeGroupCounters(tx, ev.group_id);
    }

    fireNotification('notifyEventCancelled', {
      senderId: ctx.userID,
      eventId: args.id,
      eventTitle: eTitle,
      reason: args.cancel_reason,
    });
  }),

  // Event role overrides
  createRole: defineMutator(createEventRoleSchema, async ({ tx, ctx, args }) => {
    await mutators.events.createRole.fn({ tx, ctx, args });

    if (args.event_id) {
      fireNotification('notifyEventRoleCreated', {
        senderId: ctx.userID,
        eventId: args.event_id,
        roleId: args.id,
        roleTitle: args.name,
      });
    }
  }),

  deleteRole: defineMutator(deleteEventRoleSchema, async ({ tx, ctx, args }) => {
    const pos = await tx.run(zql.role.where('id', args.id).one());

    await mutators.events.deleteRole.fn({ tx, ctx, args });

    if (pos?.event_id) {
      fireNotification('notifyEventRoleDeleted', {
        senderId: ctx.userID,
        eventId: pos.event_id,
        roleId: args.id,
        roleTitle: pos.name,
      });
    }
  }),

  // Meeting booking (meetings as events)
  bookMeeting: defineMutator(bookMeetingSchema, async ({ tx, ctx, args }) => {
    // Capacity check: count existing bookings for this instance
    const allParticipants = await tx.run(zql.event_participant.where('event_id', args.event_id));
    const ev = await tx.run(zql.event.where('id', args.event_id).one());
    if (!ev || !ev.is_bookable) return;

    const maxBookings = ev.max_bookings ?? 1;
    // Count non-organizer participants for this specific instance
    const instanceBookings = allParticipants.filter(p => {
      // Skip the organizer (creator)
      if (p.user_id === ev.creator_id) return false;
      if (args.instance_date === null || args.instance_date === undefined) {
        return p.instance_date === null || p.instance_date === undefined || p.instance_date === 0;
      }
      return p.instance_date === args.instance_date;
    });
    if (instanceBookings.length >= maxBookings) return;

    await mutators.events.bookMeeting.fn({ tx, ctx, args });

    await recomputeEventCounters(tx, args.event_id);
    await syncUserWithEventConversation(tx, {
      eventId: args.event_id,
      userId: ctx.userID,
    });

    const [eTitle, uName] = await Promise.all([
      eventTitle(tx, args.event_id),
      userName(tx, ctx.userID),
    ]);
    fireNotification('notifyMeetingBooked', {
      senderId: ctx.userID,
      senderName: uName,
      eventId: args.event_id,
      eventTitle: eTitle,
    });
  }),

  cancelMeetingBooking: defineMutator(cancelMeetingBookingSchema, async ({ tx, ctx, args }) => {
    await mutators.events.cancelMeetingBooking.fn({ tx, ctx, args });

    await recomputeEventCounters(tx, args.event_id);
    await syncUserWithEventConversation(tx, {
      eventId: args.event_id,
      userId: ctx.userID,
    });

    const [eTitle, uName] = await Promise.all([
      eventTitle(tx, args.event_id),
      userName(tx, ctx.userID),
    ]);
    fireNotification('notifyMeetingCancelled', {
      senderId: ctx.userID,
      senderName: uName,
      eventId: args.event_id,
      eventTitle: eTitle,
    });
  }),
};
