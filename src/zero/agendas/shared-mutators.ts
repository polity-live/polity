import { defineMutator } from '@rocicorp/zero';
import {
  createAgendaItemSchema,
  updateAgendaItemSchema,
  deleteAgendaItemSchema,
  reorderAgendaItemsSchema,
  createSpeakerListSchema,
  deleteSpeakerListSchema,
  createAgendaItemChangeRequestSchema,
  updateAgendaItemChangeRequestSchema,
  deleteAgendaItemChangeRequestSchema,
  reorderAgendaItemChangeRequestsSchema,
  initializeChangeRequestVotingSchema,
  processCRVoteResultSchema,
} from './schema';
import { z } from 'zod';
import { can } from '../rbac/can';
import { denyPublicApiMutation, requireAuthenticated } from '../rbac/authorize';
import { PermissionError } from '../rbac/errors';
import { zql } from '../schema';

type AgendaTx = Parameters<typeof can>[0];
type AgendaCtx = Parameters<typeof can>[1];

async function loadAgendaItem(tx: AgendaTx, agendaItemId: string) {
  const item = await tx.run(zql.agenda_item.where('id', agendaItemId).one());
  if (!item) {
    throw new Error('Agenda item not found');
  }
  return item;
}

async function assertAgendaItemAccess(
  tx: AgendaTx,
  ctx: AgendaCtx,
  agendaItem: { event_id?: string | null; amendment_id?: string | null },
  action: 'create' | 'update' | 'delete' | 'manage'
) {
  if (tx.location === 'client') return;

  if (agendaItem.event_id) {
    await can(tx, ctx, { action, resource: 'agendaItems', eventId: agendaItem.event_id });
    return;
  }

  if (agendaItem.amendment_id) {
    await can(tx, ctx, {
      action: 'update',
      resource: 'amendments',
      amendmentId: agendaItem.amendment_id,
    });
    return;
  }

  throw new PermissionError(action, 'agendaItems', 'parent required');
}

async function assertAgendaItemAccessById(
  tx: AgendaTx,
  ctx: AgendaCtx,
  agendaItemId: string,
  action: 'update' | 'delete' | 'manage'
) {
  if (tx.location === 'client') return;
  const item = await loadAgendaItem(tx, agendaItemId);
  await assertAgendaItemAccess(tx, ctx, item, action);
}

async function loadAgendaItemForSpeaker(tx: AgendaTx, speakerId: string) {
  const speaker = await tx.run(zql.speaker_list.where('id', speakerId).one());
  if (!speaker) {
    throw new Error('Speaker list entry not found');
  }
  const agendaItem = await loadAgendaItem(tx, speaker.agenda_item_id);
  return { speaker, agendaItem };
}

async function assertCanManageSpeakersForAgendaItem(
  tx: AgendaTx,
  ctx: AgendaCtx,
  agendaItemId: string
) {
  if (tx.location === 'client') return;
  const agendaItem = await loadAgendaItem(tx, agendaItemId);
  if (!agendaItem.event_id) {
    await assertAgendaItemAccess(tx, ctx, agendaItem, 'manage');
    return;
  }
  await can(tx, ctx, {
    action: 'manage_speakers',
    resource: 'events',
    eventId: agendaItem.event_id,
  });
}

async function assertCanAddOrRemoveSpeaker(
  tx: AgendaTx,
  ctx: AgendaCtx,
  agendaItem: { event_id?: string | null },
  speakerUserId: string | null | undefined
) {
  if (tx.location === 'client') return;

  requireAuthenticated(tx, ctx, { action: 'speak', resource: 'events' });

  if (speakerUserId === ctx.userID && agendaItem.event_id) {
    await can(tx, ctx, { action: 'speak', resource: 'events', eventId: agendaItem.event_id });
    return;
  }

  if (agendaItem.event_id) {
    await can(tx, ctx, {
      action: 'manage_speakers',
      resource: 'events',
      eventId: agendaItem.event_id,
    });
    return;
  }

  throw new PermissionError('speak', 'events', 'event required');
}

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const agendaSharedMutators = {
  // Create an agenda item
  createAgendaItem: defineMutator(createAgendaItemSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    await assertAgendaItemAccess(tx, ctx, args, 'create');
    const now = Date.now();
    await tx.mutate.agenda_item.insert({
      ...args,
      creator_id: userID,
      created_at: now,
      updated_at: now,
    });
  }),

  // Update an agenda item
  updateAgendaItem: defineMutator(updateAgendaItemSchema, async ({ tx, ctx, args }) => {
    await assertAgendaItemAccessById(tx, ctx, args.id, 'update');
    const { id, ...fields } = args;
    await tx.mutate.agenda_item.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  // Reorder agenda items
  reorderAgendaItems: defineMutator(reorderAgendaItemsSchema, async ({ tx, ctx, args }) => {
    for (const item of args.items) {
      await assertAgendaItemAccessById(tx, ctx, item.id, 'manage');
      await tx.mutate.agenda_item.update({
        id: item.id,
        order_index: item.order_index,
        updated_at: Date.now(),
      });
    }
  }),

  // Add a speaker to the speaker list
  addSpeaker: defineMutator(createSpeakerListSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const agendaItem = await loadAgendaItem(tx, args.agenda_item_id);
      await assertCanAddOrRemoveSpeaker(tx, ctx, agendaItem, args.user_id);
    }

    const now = Date.now();
    await tx.mutate.speaker_list.insert({
      ...args,
      created_at: now,
    });
  }),

  // Delete an agenda item
  deleteAgendaItem: defineMutator(deleteAgendaItemSchema, async ({ tx, ctx, args }) => {
    await assertAgendaItemAccessById(tx, ctx, args.id, 'delete');
    await tx.mutate.agenda_item.delete({ id: args.id });
  }),

  // Remove a speaker from the speaker list
  removeSpeaker: defineMutator(deleteSpeakerListSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const { speaker, agendaItem } = await loadAgendaItemForSpeaker(tx, args.id);
      await assertCanAddOrRemoveSpeaker(tx, ctx, agendaItem, speaker.user_id);
    }

    await tx.mutate.speaker_list.delete({ id: args.id });
  }),

  // Update a speaker in the speaker list
  updateSpeaker: defineMutator(
    z.object({
      id: z.string(),
      completed: z.boolean().optional(),
      order_index: z.number().optional(),
      time: z.number().optional(),
      start_time: z.number().nullable().optional(),
      end_time: z.number().nullable().optional(),
    }),
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const { speaker } = await loadAgendaItemForSpeaker(tx, args.id);
        await assertCanManageSpeakersForAgendaItem(tx, ctx, speaker.agenda_item_id);
      }
      await tx.mutate.speaker_list.update(args);
    }
  ),

  // ── Agenda Item Change Requests ────────────────────────────────────

  // Create a junction record linking a CR (or final vote) to an agenda item
  createAgendaItemChangeRequest: defineMutator(
    createAgendaItemChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      await assertAgendaItemAccessById(tx, ctx, args.agenda_item_id, 'manage');
      const now = Date.now();
      await tx.mutate.agenda_item_change_request.insert({
        ...args,
        created_at: now,
        updated_at: now,
      });
    }
  ),

  // Update a junction record (e.g. link vote_id, change status)
  updateAgendaItemChangeRequest: defineMutator(
    updateAgendaItemChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const row = await tx.run(zql.agenda_item_change_request.where('id', args.id).one());
        if (!row) throw new Error('Agenda item change request not found');
        await assertAgendaItemAccessById(tx, ctx, row.agenda_item_id, 'manage');
      }

      const { id, ...fields } = args;
      await tx.mutate.agenda_item_change_request.update({
        id,
        ...fields,
        updated_at: Date.now(),
      });
    }
  ),

  // Reorder CR timeline items within an agenda item
  reorderAgendaItemChangeRequests: defineMutator(
    reorderAgendaItemChangeRequestsSchema,
    async ({ tx, ctx, args }) => {
      for (const item of args.items) {
        if (tx.location !== 'client') {
          const row = await tx.run(zql.agenda_item_change_request.where('id', item.id).one());
          if (!row) throw new Error('Agenda item change request not found');
          await assertAgendaItemAccessById(tx, ctx, row.agenda_item_id, 'manage');
        }
        await tx.mutate.agenda_item_change_request.update({
          id: item.id,
          order_index: item.order_index,
          updated_at: Date.now(),
        });
      }
    }
  ),

  // Delete a junction record
  deleteAgendaItemChangeRequest: defineMutator(
    deleteAgendaItemChangeRequestSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const row = await tx.run(zql.agenda_item_change_request.where('id', args.id).one());
        if (!row) throw new Error('Agenda item change request not found');
        await assertAgendaItemAccessById(tx, ctx, row.agenda_item_id, 'manage');
      }

      await tx.mutate.agenda_item_change_request.delete({ id: args.id });
    }
  ),

  // Client-side no-op — server mutator handles the actual initialization
  initializeChangeRequestVoting: defineMutator(
    initializeChangeRequestVotingSchema,
    async ({ tx }) => {
      denyPublicApiMutation(tx, {
        action: 'manage_votes',
        resource: 'events',
        scope: 'server override required',
      });
      // Server-only: creates votes, choices, voters, and junction records
    }
  ),

  // Client-side no-op — server mutator handles CR vote result processing
  processCRVoteResult: defineMutator(processCRVoteResultSchema, async ({ tx }) => {
    denyPublicApiMutation(tx, {
      action: 'manage_votes',
      resource: 'events',
      scope: 'server override required',
    });
    // Server-only: accepts/rejects suggestion, saves document version, advances timeline
  }),
};
