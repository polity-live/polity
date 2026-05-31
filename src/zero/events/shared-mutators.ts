import { defineMutator } from '@rocicorp/zero';
import { z } from 'zod';
import { normalizeDelegateElectionMode } from '@/features/elections/logic/electionMode';
import { getDefaultOfflineParticipationChannel } from '../offline-roster-helpers';
import { zql } from '../schema';
import {
  eventCreateSchema,
  eventUpdateSchema,
  eventCancelSchema,
  eventParticipantCreateSchema,
  eventParticipantLegacyRoleUpdateSchema,
  eventParticipantDeleteSchema,
  eventOfflineParticipantCreateSchema,
  eventOfflineParticipantUpdateSchema,
  eventOfflineParticipantDeleteSchema,
  eventOfflineParticipantBulkImportSchema,
  eventParticipantRoleAssignSchema,
  eventParticipantRoleUnassignSchema,
  eventParticipantRolesSyncSchema,
  createEventRoleSchema,
  updateEventRoleSchema,
  deleteEventRoleSchema,
  eventExceptionCreateSchema,
  eventExceptionUpdateSchema,
  eventExceptionDeleteSchema,
  bookMeetingSchema,
  cancelMeetingBookingSchema,
} from './schema';
import { can } from '../rbac/can';

function isAssemblyEventType(eventType: string | null | undefined) {
  return eventType === 'general_assembly' || eventType === 'delegate_assembly';
}

function resolveAttendanceMode(event: {
  attendance_mode?: string | null;
  location_type?: string | null;
}) {
  if (event.attendance_mode === 'online' || event.attendance_mode === 'hybrid') {
    return event.attendance_mode;
  }

  return event.location_type === 'online' ? 'online' : 'offline';
}

function normalizeRequiredName(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('First name and last name are required.');
  }

  return trimmedValue;
}

function normalizeOptionalReason(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? '';
  return trimmedValue.length > 0 ? trimmedValue : null;
}

async function loadParticipantForRoleMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  eventParticipantId: string
) {
  const participant = await tx.run(zql.event_participant.where('id', eventParticipantId).one());
  if (!participant) {
    throw new Error('Participant not found');
  }

  await can(tx, ctx, {
    action: 'manage_participants',
    resource: 'events',
    eventId: participant.event_id,
  });

  return participant;
}

async function assertCanManageEventOfflineParticipants(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  eventId: string
) {
  await can(tx, ctx, {
    action: 'manage_participants',
    resource: 'events',
    eventId,
  });

  const event = await tx.run(zql.event.where('id', eventId).one());
  if (!event) {
    throw new Error('Event not found');
  }

  if (resolveAttendanceMode(event) === 'online') {
    throw new Error('Online-only events cannot manage offline or hybrid participants.');
  }

  return event;
}

async function loadOfflineParticipantForMutation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  offlineParticipantId: string
) {
  const offlineParticipant = await tx.run(
    zql.event_offline_participant.where('id', offlineParticipantId).one()
  );
  if (!offlineParticipant) {
    throw new Error('Offline participant not found');
  }

  const event = await assertCanManageEventOfflineParticipants(tx, ctx, offlineParticipant.event_id);
  return {
    event,
    offlineParticipant,
  };
}

async function assertUniqueConnectedOfflineUserWithinEvent(
  tx: Parameters<typeof can>[0],
  args: {
    eventId: string;
    connectedUserId?: string | null;
    excludeOfflineParticipantId?: string;
  }
) {
  if (!args.connectedUserId) {
    return;
  }

  const existingOfflineParticipants = await tx.run(
    zql.event_offline_participant
      .where('event_id', args.eventId)
      .where('connected_user_id', args.connectedUserId)
  );
  const hasConflict = existingOfflineParticipants.some(
    offlineParticipant => offlineParticipant.id !== args.excludeOfflineParticipantId
  );
  if (hasConflict) {
    throw new Error('This active user is already connected to another offline participant.');
  }
}

async function addEventParticipantRole(
  tx: Parameters<typeof can>[0],
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

async function removeEventParticipantRole(
  tx: Parameters<typeof can>[0],
  args: {
    event_participant_id: string;
    role_id: string;
  }
) {
  const existingLinks = await tx.run(
    zql.event_participant_role
      .where('event_participant_id', args.event_participant_id)
      .where('role_id', args.role_id)
  );

  for (const link of existingLinks) {
    await tx.mutate.event_participant_role.delete({ id: link.id });
  }
}

async function syncEventParticipantRoles(
  tx: Parameters<typeof can>[0],
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
  const existingRoleIds = new Set(existingLinks.map(link => link.role_id));
  const desiredRoleIdSet = new Set(desiredRoleIds);

  for (const link of existingLinks) {
    if (!desiredRoleIdSet.has(link.role_id)) {
      await tx.mutate.event_participant_role.delete({ id: link.id });
    }
  }

  for (const roleId of desiredRoleIds) {
    if (!existingRoleIds.has(roleId)) {
      await addEventParticipantRole(tx, {
        event_participant_id: args.event_participant_id,
        role_id: roleId,
        assigned_by_id: args.assigned_by_id,
      });
    }
  }
}

async function resolveDefaultEventParticipantRoleId(
  tx: Parameters<typeof can>[0],
  eventId: string,
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
    zql.role.where('event_id', eventId).where('scope', 'event').orderBy('sort_order', 'asc')
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

  return roles.find(role => role.name === 'Participant')?.id ?? null;
}

async function clearEventRoleDefaults(
  tx: Parameters<typeof can>[0],
  args: {
    eventId: string;
    keepRoleId?: string;
    clearRequestDefault?: boolean;
    clearInviteDefault?: boolean;
  }
) {
  if (!args.clearRequestDefault && !args.clearInviteDefault) {
    return;
  }

  const eventRoles = await tx.run(zql.role.where('event_id', args.eventId).where('scope', 'event'));

  for (const role of eventRoles) {
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

async function assertValidEventRoleDefaults(
  tx: Parameters<typeof can>[0],
  args: {
    eventId: string;
    assigneeKind: 'member' | 'guest';
    defaultRequestRole: boolean;
  }
) {
  if (!args.defaultRequestRole) {
    return;
  }

  const event = await tx.run(zql.event.where('id', args.eventId).one());
  const assemblyEvent = isAssemblyEventType(event?.event_type);

  if (assemblyEvent && args.assigneeKind !== 'guest') {
    throw new Error('Assembly event request roles must be guest roles.');
  }

  if (!assemblyEvent && args.assigneeKind === 'guest') {
    throw new Error('Guest roles can only be used as request roles for assembly events.');
  }
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const eventSharedMutators = {
  create: defineMutator(eventCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    const { invited_user_ids, debug_correlation_id, ...eventArgs } = args;
    void invited_user_ids;
    void debug_correlation_id;
    const delegateElectionMode = normalizeDelegateElectionMode(args.delegate_election_mode);
    const attendanceMode = resolveAttendanceMode({
      attendance_mode: args.attendance_mode,
      location_type: args.location_type,
    });

    await tx.mutate.event.insert({
      ...eventArgs,
      attendance_mode: attendanceMode,
      delegate_election_mode: delegateElectionMode,
      creator_id: userID,
      participant_count: 1,
      subscriber_count: 0,
      election_count: 0,
      amendment_count: 0,
      open_change_request_count: 0,
      delegate_count: 0,
      cancel_reason: '',
      cancelled_at: 0,
      cancelled_by_id: null,
      created_at: now,
      updated_at: now,
    } as Parameters<typeof tx.mutate.event.insert>[0]);

    // Optimistically add creator as participant (server mutator assigns Organizer role)
    await tx.mutate.event_participant.insert({
      id: crypto.randomUUID(),
      event_id: args.id,
      user_id: userID,
      group_id: args.group_id ?? null,
      status: 'active',
      visibility: args.visibility ?? 'public',
      instance_date: null,
      created_at: now,
    });
  }),

  update: defineMutator(eventUpdateSchema, async ({ tx, args }) => {
    const currentEvent = await tx.run(zql.event.where('id', args.id).one());
    const { debug_correlation_id, ...eventArgs } = args;
    void debug_correlation_id;
    const delegateElectionMode = normalizeDelegateElectionMode(
      eventArgs.delegate_election_mode ?? currentEvent?.delegate_election_mode
    );
    const attendanceMode =
      args.attendance_mode !== undefined || args.location_type !== undefined
        ? resolveAttendanceMode({
            attendance_mode: args.attendance_mode ?? currentEvent?.attendance_mode,
            location_type: args.location_type ?? currentEvent?.location_type,
          })
        : undefined;

    await tx.mutate.event.update({
      ...eventArgs,
      ...(attendanceMode !== undefined ? { attendance_mode: attendanceMode } : {}),
      delegate_election_mode: delegateElectionMode,
      updated_at: Date.now(),
    });
  }),

  cancel: defineMutator(eventCancelSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.event.update({
      id: args.id,
      status: 'cancelled',
      cancel_reason: args.cancel_reason,
      cancelled_at: now,
      cancelled_by_id: userID,
      updated_at: now,
    });
  }),

  createOfflineParticipant: defineMutator(
    eventOfflineParticipantCreateSchema,
    async ({ tx, ctx, args }) => {
      const event = await assertCanManageEventOfflineParticipants(tx, ctx, args.event_id);
      if (args.source_type !== 'event_extra') {
        throw new Error('Inherited group offline participants are managed automatically.');
      }

      await assertUniqueConnectedOfflineUserWithinEvent(tx, {
        eventId: args.event_id,
        connectedUserId: args.connected_user_id ?? null,
      });

      const createdAt = Date.now();
      const attendanceMode = resolveAttendanceMode(event);
      await tx.mutate.event_offline_participant.insert({
        id: args.id,
        event_id: args.event_id,
        group_offline_member_id: null,
        source_type: 'event_extra',
        first_name: normalizeRequiredName(args.first_name),
        last_name: normalizeRequiredName(args.last_name),
        reason_not_signed_up: normalizeOptionalReason(args.reason_not_signed_up),
        connected_user_id: args.connected_user_id ?? null,
        attendance_status: args.attendance_status ?? 'listed',
        participation_channel:
          attendanceMode === 'offline'
            ? 'offline'
            : (args.participation_channel ??
              getDefaultOfflineParticipationChannel({
                attendanceMode,
                connectedUserId: args.connected_user_id ?? null,
              })),
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  ),

  updateOfflineParticipant: defineMutator(
    eventOfflineParticipantUpdateSchema,
    async ({ tx, ctx, args }) => {
      const { event, offlineParticipant } = await loadOfflineParticipantForMutation(
        tx,
        ctx,
        args.id
      );
      const attendanceMode = resolveAttendanceMode(event);

      if (offlineParticipant.source_type === 'group_member') {
        if (
          args.first_name !== undefined ||
          args.last_name !== undefined ||
          args.reason_not_signed_up !== undefined
        ) {
          throw new Error('Inherited group offline participants can only update attendance data.');
        }
      }

      const nextConnectedUserId =
        args.connected_user_id !== undefined
          ? args.connected_user_id
          : offlineParticipant.connected_user_id;
      await assertUniqueConnectedOfflineUserWithinEvent(tx, {
        eventId: offlineParticipant.event_id,
        connectedUserId: nextConnectedUserId,
        excludeOfflineParticipantId: offlineParticipant.id,
      });

      const nextParticipationChannel =
        attendanceMode === 'offline'
          ? 'offline'
          : (args.participation_channel ?? offlineParticipant.participation_channel);

      await tx.mutate.event_offline_participant.update({
        id: args.id,
        ...(args.first_name !== undefined
          ? { first_name: normalizeRequiredName(args.first_name) }
          : {}),
        ...(args.last_name !== undefined
          ? { last_name: normalizeRequiredName(args.last_name) }
          : {}),
        ...(args.reason_not_signed_up !== undefined
          ? { reason_not_signed_up: normalizeOptionalReason(args.reason_not_signed_up) }
          : {}),
        ...(args.connected_user_id !== undefined
          ? { connected_user_id: args.connected_user_id ?? null }
          : {}),
        ...(args.attendance_status !== undefined
          ? { attendance_status: args.attendance_status }
          : {}),
        participation_channel: nextParticipationChannel,
        updated_at: Date.now(),
      });
    }
  ),

  deleteOfflineParticipant: defineMutator(
    eventOfflineParticipantDeleteSchema,
    async ({ tx, ctx, args }) => {
      const { offlineParticipant } = await loadOfflineParticipantForMutation(tx, ctx, args.id);
      if (offlineParticipant.source_type === 'group_member') {
        throw new Error('Inherited group offline participants cannot be deleted from the event.');
      }

      await tx.mutate.event_offline_participant.delete({ id: args.id });
    }
  ),

  importOfflineParticipants: defineMutator(
    eventOfflineParticipantBulkImportSchema,
    async ({ tx, ctx, args }) => {
      const event = await assertCanManageEventOfflineParticipants(tx, ctx, args.event_id);
      const attendanceMode = resolveAttendanceMode(event);
      const existingOfflineParticipants = await tx.run(
        zql.event_offline_participant.where('event_id', args.event_id)
      );
      const existingKeys = new Set(
        existingOfflineParticipants
          .filter(offlineParticipant => offlineParticipant.source_type === 'event_extra')
          .map(offlineParticipant =>
            [
              offlineParticipant.first_name.trim().toLowerCase(),
              offlineParticipant.last_name.trim().toLowerCase(),
              (offlineParticipant.reason_not_signed_up ?? '').trim().toLowerCase(),
            ].join('|')
          )
      );
      const seenImportKeys = new Set<string>();
      const createdAt = Date.now();

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
        await tx.mutate.event_offline_participant.insert({
          id: crypto.randomUUID(),
          event_id: args.event_id,
          group_offline_member_id: null,
          source_type: 'event_extra',
          first_name: firstName,
          last_name: lastName,
          reason_not_signed_up: reasonNotSignedUp,
          connected_user_id: null,
          attendance_status: 'listed',
          participation_channel: attendanceMode === 'offline' ? 'offline' : 'offline',
          created_at: createdAt,
          updated_at: createdAt,
        });
      }
    }
  ),

  joinEvent: defineMutator(eventParticipantCreateSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    const { initial_role_id, visibility, ...participantArgs } = args;
    await tx.mutate.event_participant.insert({
      ...participantArgs,
      user_id: userID,
      status: args.status ?? 'requested',
      visibility: visibility ?? 'public',
      created_at: now,
    });

    const initialRoleId = await resolveDefaultEventParticipantRoleId(
      tx,
      args.event_id,
      args.status ?? 'requested',
      initial_role_id
    );

    if (initialRoleId) {
      await syncEventParticipantRoles(tx, {
        event_participant_id: args.id,
        role_ids: [initialRoleId],
        assigned_by_id: userID,
      });
    }
  }),

  // Invite another user as participant (keeps provided user_id instead of ctx.userID)
  inviteParticipant: defineMutator(eventParticipantCreateSchema, async ({ tx, args }) => {
    const now = Date.now();
    if (!args.user_id) {
      throw new Error('user_id is required when inviting an event participant');
    }

    const { initial_role_id, visibility, ...participantArgs } = args;

    await tx.mutate.event_participant.insert({
      ...participantArgs,
      user_id: args.user_id,
      status: 'invited',
      visibility: visibility ?? 'public',
      created_at: now,
    });

    const initialRoleId = await resolveDefaultEventParticipantRoleId(
      tx,
      args.event_id,
      'invited',
      initial_role_id
    );

    if (initialRoleId) {
      await syncEventParticipantRoles(tx, {
        event_participant_id: args.id,
        role_ids: [initialRoleId],
        assigned_by_id: null,
      });
    }
  }),

  leaveEvent: defineMutator(eventParticipantDeleteSchema, async ({ tx, args }) => {
    await tx.mutate.event_participant.delete({ id: args.id });
  }),

  finalizeDelegates: defineMutator(z.object({ eventId: z.string() }), async ({ tx, args }) => {
    await tx.mutate.event.update({
      id: args.eventId,
      delegate_distribution_status: 'finalized',
      delegate_finalized_at: Date.now(),
      updated_at: Date.now(),
    });
  }),

  // Event Participant update
  addParticipantRole: defineMutator(eventParticipantRoleAssignSchema, async ({ tx, ctx, args }) => {
    await loadParticipantForRoleMutation(tx, ctx, args.event_participant_id);
    await addEventParticipantRole(tx, args);
  }),

  removeParticipantRole: defineMutator(
    eventParticipantRoleUnassignSchema,
    async ({ tx, ctx, args }) => {
      await loadParticipantForRoleMutation(tx, ctx, args.event_participant_id);
      await removeEventParticipantRole(tx, args);
    }
  ),

  syncParticipantRoles: defineMutator(
    eventParticipantRolesSyncSchema,
    async ({ tx, ctx, args }) => {
      await loadParticipantForRoleMutation(tx, ctx, args.event_participant_id);
      await syncEventParticipantRoles(tx, args);
    }
  ),

  updateParticipant: defineMutator(
    eventParticipantLegacyRoleUpdateSchema,
    async ({ tx, ctx, args }) => {
      const { role_id, ...participantArgs } = args;

      if (Object.keys(participantArgs).length > 1) {
        await tx.mutate.event_participant.update(participantArgs);
      }

      if (role_id !== undefined) {
        await loadParticipantForRoleMutation(tx, ctx, args.id);
        await syncEventParticipantRoles(tx, {
          event_participant_id: args.id,
          role_ids: role_id ? [role_id] : [],
          assigned_by_id: ctx.userID,
        });
      }
    }
  ),

  // Event role mutators
  createRole: defineMutator(createEventRoleSchema, async ({ tx, args }) => {
    const now = Date.now();
    const existingRoles = await tx.run(
      zql.role.where('event_id', args.event_id).where('scope', 'event')
    );
    const assigneeKind = args.assignee_kind ?? 'member';

    await assertValidEventRoleDefaults(tx, {
      eventId: args.event_id,
      assigneeKind,
      defaultRequestRole: Boolean(args.default_request_role),
    });

    await clearEventRoleDefaults(tx, {
      eventId: args.event_id,
      clearRequestDefault: Boolean(args.default_request_role),
      clearInviteDefault: Boolean(args.default_invite_role),
    });

    await tx.mutate.role.insert({
      id: args.id,
      name: args.name,
      description: args.description ?? null,
      scope: 'event',
      group_id: args.group_id ?? null,
      event_id: args.event_id,
      amendment_id: args.amendment_id ?? null,
      blog_id: args.blog_id ?? null,
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
      sort_order: args.sort_order ?? existingRoles.length,
      created_at: now,
    });
  }),

  updateRole: defineMutator(updateEventRoleSchema, async ({ tx, args }) => {
    const role = await tx.run(zql.role.where('id', args.id).one());
    if (role?.event_id) {
      const nextAssigneeKind = args.assignee_kind ?? role.assignee_kind ?? 'member';
      const nextDefaultRequestRole = args.default_request_role ?? role.default_request_role;

      await assertValidEventRoleDefaults(tx, {
        eventId: role.event_id,
        assigneeKind: nextAssigneeKind === 'guest' ? 'guest' : 'member',
        defaultRequestRole: Boolean(nextDefaultRequestRole),
      });

      await clearEventRoleDefaults(tx, {
        eventId: role.event_id,
        keepRoleId: role.id,
        clearRequestDefault: args.default_request_role === true,
        clearInviteDefault: args.default_invite_role === true,
      });
    }

    await tx.mutate.role.update(args);
  }),

  deleteRole: defineMutator(deleteEventRoleSchema, async ({ tx, args }) => {
    await tx.mutate.role.delete({ id: args.id });
  }),

  // Event Exception mutators
  createException: defineMutator(eventExceptionCreateSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.event_exception.insert({
      ...args,
      created_at: now,
      updated_at: now,
    });
  }),

  updateException: defineMutator(eventExceptionUpdateSchema, async ({ tx, args }) => {
    await tx.mutate.event_exception.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteException: defineMutator(eventExceptionDeleteSchema, async ({ tx, args }) => {
    await tx.mutate.event_exception.delete({ id: args.id });
  }),

  // Meeting booking mutators (meetings as events)
  bookMeeting: defineMutator(bookMeetingSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.event_participant.insert({
      id: crypto.randomUUID(),
      event_id: args.event_id,
      user_id: userID,
      group_id: null,
      status: 'active',
      visibility: 'public',
      instance_date: args.instance_date,
      created_at: now,
    });
  }),

  cancelMeetingBooking: defineMutator(
    cancelMeetingBookingSchema,
    async ({ tx, ctx: { userID }, args }) => {
      // Find the participant entry for this user + event + instance
      const participants = await tx.run(
        zql.event_participant.where('event_id', args.event_id).where('user_id', userID)
      );
      const match = participants.find(p => {
        if (args.instance_date === null || args.instance_date === undefined) {
          return p.instance_date === null || p.instance_date === undefined || p.instance_date === 0;
        }
        return p.instance_date === args.instance_date;
      });
      if (match) {
        await tx.mutate.event_participant.delete({ id: match.id });
      }
    }
  ),
};
