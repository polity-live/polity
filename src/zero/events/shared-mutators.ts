import { defineMutator } from '@rocicorp/zero';
import { z } from 'zod';
import { normalizeDelegateElectionMode } from '@/features/elections/logic/electionMode';
import { zql } from '../schema';
import {
  eventCreateSchema,
  eventUpdateSchema,
  eventCancelSchema,
  eventParticipantCreateSchema,
  eventParticipantLegacyRoleUpdateSchema,
  eventParticipantDeleteSchema,
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

    await tx.mutate.event.insert({
      ...eventArgs,
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

    await tx.mutate.event.update({
      ...eventArgs,
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
