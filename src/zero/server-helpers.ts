/**
 * Shared helpers for server-side mutator overrides.
 * Provides DB lookup functions used across domain server-mutators.
 */
import { type Transaction } from '@rocicorp/zero';
import { zql, type Schema } from './schema';

type ZeroTransaction = Transaction<Schema>;

export const ACTIVE_GROUP_STATUSES = new Set(['active', 'member', 'admin']);
export const ACTIVE_EVENT_STATUSES = new Set(['active', 'confirmed', 'member', 'admin']);
const ACTIVE_COLLABORATOR_STATUSES = new Set(['collaborator', 'member', 'admin']);

function isOpenChangeRequest(status: string | null | undefined) {
  return !status || status === 'open';
}

export function isActiveGroupStatus(status: string | null | undefined) {
  return ACTIVE_GROUP_STATUSES.has(status ?? '');
}

export function isActiveEventStatus(status: string | null | undefined) {
  return ACTIVE_EVENT_STATUSES.has(status ?? '');
}

/** Read group name by id. */
export async function groupName(tx: Transaction<Schema>, groupId: string): Promise<string> {
  const g = await tx.run(zql.group.where('id', groupId).one());
  return g?.name ?? 'Group';
}

/** Read event title by id. */
export async function eventTitle(tx: Transaction<Schema>, eventId: string): Promise<string> {
  const e = await tx.run(zql.event.where('id', eventId).one());
  return e?.title ?? 'Event';
}

/** Read amendment title by id. */
export async function amendmentTitle(
  tx: Transaction<Schema>,
  amendmentId: string
): Promise<string> {
  const a = await tx.run(zql.amendment.where('id', amendmentId).one());
  return a?.title ?? 'Amendment';
}

/** Read blog title by id. */
export async function blogTitle(tx: Transaction<Schema>, blogId: string): Promise<string> {
  const b = await tx.run(zql.blog.where('id', blogId).one());
  return b?.title ?? 'Blog';
}

/** Read user display name. */
export async function userName(tx: Transaction<Schema>, userId: string): Promise<string> {
  const u = await tx.run(zql.user.where('id', userId).one());
  return (
    [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email?.split('@')[0] || 'A user'
  );
}

/** Read role by id. */
export async function roleName(
  tx: Transaction<Schema>,
  roleId: string
): Promise<{ name: string; groupId: string | null }> {
  const r = await tx.run(zql.role.where('id', roleId).one());
  return { name: r?.name ?? 'Role', groupId: r?.group_id ?? null };
}

async function ensureConversationParticipant(
  tx: ZeroTransaction,
  conversationId: string,
  userId: string
): Promise<void> {
  const existingParticipant = await tx.run(
    zql.conversation_participant
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .one()
  );

  if (existingParticipant) {
    if (existingParticipant.left_at) {
      await tx.mutate.conversation_participant.update({
        id: existingParticipant.id,
        left_at: null,
      });
    }
    return;
  }

  const now = Date.now();

  await tx.mutate.conversation_participant.insert({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    user_id: userId,
    joined_at: now,
    last_read_at: now,
    left_at: null,
  });
}

async function removeConversationParticipant(
  tx: ZeroTransaction,
  conversationId: string,
  userId: string
): Promise<void> {
  const existingParticipant = await tx.run(
    zql.conversation_participant
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .one()
  );

  if (!existingParticipant) {
    return;
  }

  await tx.mutate.conversation_participant.delete({ id: existingParticipant.id });
}

export async function ensureGroupConversation(
  tx: ZeroTransaction,
  args: {
    groupId: string;
    name?: string | null;
    requestedById: string;
    createdAt?: number;
  }
): Promise<string> {
  const existingConversation = await tx.run(
    zql.conversation.where('group_id', args.groupId).where('type', 'group').one()
  );

  if (existingConversation) {
    return existingConversation.id;
  }

  const now = args.createdAt ?? Date.now();
  const conversationId = crypto.randomUUID();

  await tx.mutate.conversation.insert({
    id: conversationId,
    type: 'group',
    name: args.name?.trim() || 'Group Chat',
    status: 'accepted',
    pinned: false,
    last_message_at: now,
    assistant_for_user_id: null,
    group_id: args.groupId,
    event_id: null,
    requested_by_id: args.requestedById,
    created_at: now,
  });

  return conversationId;
}

export async function ensureEventConversation(
  tx: ZeroTransaction,
  args: {
    eventId: string;
    name?: string | null;
    requestedById: string;
    createdAt?: number;
  }
): Promise<string> {
  const existingConversation = await tx.run(
    zql.conversation.where('event_id', args.eventId).where('type', 'event').one()
  );

  if (existingConversation) {
    return existingConversation.id;
  }

  const now = args.createdAt ?? Date.now();
  const conversationId = crypto.randomUUID();

  await tx.mutate.conversation.insert({
    id: conversationId,
    type: 'event',
    name: args.name?.trim() || 'Event Chat',
    status: 'accepted',
    pinned: false,
    last_message_at: now,
    assistant_for_user_id: null,
    group_id: null,
    event_id: args.eventId,
    requested_by_id: args.requestedById,
    created_at: now,
  });

  return conversationId;
}

export async function syncUserWithGroupConversation(
  tx: ZeroTransaction,
  args: {
    groupId: string;
    userId: string;
  }
): Promise<void> {
  const conversation = await tx.run(
    zql.conversation.where('group_id', args.groupId).where('type', 'group').one()
  );

  if (!conversation) {
    return;
  }

  const memberships = await tx.run(
    zql.group_membership.where('group_id', args.groupId).where('user_id', args.userId)
  );
  const shouldParticipate = memberships.some(membership => isActiveGroupStatus(membership.status));

  if (shouldParticipate) {
    await ensureConversationParticipant(tx, conversation.id, args.userId);
    return;
  }

  await removeConversationParticipant(tx, conversation.id, args.userId);
}

export async function syncUserWithEventConversation(
  tx: ZeroTransaction,
  args: {
    eventId: string;
    userId: string;
  }
): Promise<void> {
  const conversation = await tx.run(
    zql.conversation.where('event_id', args.eventId).where('type', 'event').one()
  );

  if (!conversation) {
    return;
  }

  const participations = await tx.run(
    zql.event_participant.where('event_id', args.eventId).where('user_id', args.userId)
  );
  const shouldParticipate = participations.some(participant =>
    isActiveEventStatus(participant.status)
  );

  if (shouldParticipate) {
    await ensureConversationParticipant(tx, conversation.id, args.userId);
    return;
  }

  await removeConversationParticipant(tx, conversation.id, args.userId);
}

export async function recomputeUserCounters(
  tx: Transaction<Schema>,
  userId: string
): Promise<void> {
  const [subscribers, memberships, amendments] = await Promise.all([
    tx.run(zql.subscriber.where('user_id', userId)),
    tx.run(zql.group_membership.where('user_id', userId)),
    tx.run(zql.amendment.where('created_by_id', userId)),
  ]);

  const groups = memberships.filter(
    membership => membership.source !== 'derived' && isActiveGroupStatus(membership.status)
  ).length;

  await tx.mutate.user.update({
    id: userId,
    subscriber_count: subscribers.length,
    group_count: groups,
    amendment_count: amendments.length,
  });
}

export async function recomputeGroupCounters(
  tx: Transaction<Schema>,
  groupId: string
): Promise<void> {
  const [memberships, subscribers, events, amendments] = await Promise.all([
    tx.run(zql.group_membership.where('group_id', groupId)),
    tx.run(zql.subscriber.where('group_id', groupId)),
    tx.run(zql.event.where('group_id', groupId)),
    tx.run(zql.amendment.where('group_id', groupId)),
  ]);

  const members = memberships.filter(membership => isActiveGroupStatus(membership.status)).length;
  const activeEvents = events.filter(event => event.status !== 'cancelled').length;

  await tx.mutate.group.update({
    id: groupId,
    member_count: members,
    subscriber_count: subscribers.length,
    event_count: activeEvents,
    amendment_count: amendments.length,
  });
}

export async function recomputeEventCounters(
  tx: Transaction<Schema>,
  eventId: string
): Promise<void> {
  const [participants, subscribers, agendaItems, amendments] = await Promise.all([
    tx.run(zql.event_participant.where('event_id', eventId)),
    tx.run(zql.subscriber.where('event_id', eventId)),
    tx.run(zql.agenda_item.where('event_id', eventId)),
    tx.run(zql.amendment.where('event_id', eventId)),
  ]);

  const participantCount = participants.filter(participant =>
    isActiveEventStatus(participant.status)
  ).length;
  const agendaItemIds = agendaItems.map(item => item.id);
  const amendmentIds = amendments.map(amendment => amendment.id);

  const [elections, changeRequests] = await Promise.all([
    agendaItemIds.length > 0
      ? tx.run(zql.election.where('agenda_item_id', 'IN', agendaItemIds))
      : Promise.resolve([]),
    amendmentIds.length > 0
      ? tx.run(zql.change_request.where('amendment_id', 'IN', amendmentIds))
      : Promise.resolve([]),
  ]);

  const openChangeRequests = changeRequests.filter(changeRequest =>
    isOpenChangeRequest(changeRequest.status)
  ).length;

  await tx.mutate.event.update({
    id: eventId,
    participant_count: participantCount,
    subscriber_count: subscribers.length,
    election_count: elections.length,
    amendment_count: amendments.length,
    open_change_request_count: openChangeRequests,
  });
}

export async function recomputeAmendmentCounters(
  tx: Transaction<Schema>,
  amendmentId: string
): Promise<void> {
  const [collaborators, subscribers, clones, changeRequests, supportVotes] = await Promise.all([
    tx.run(zql.amendment_collaborator.where('amendment_id', amendmentId)),
    tx.run(zql.subscriber.where('amendment_id', amendmentId)),
    tx.run(zql.amendment.where('clone_source_id', amendmentId)),
    tx.run(zql.change_request.where('amendment_id', amendmentId)),
    tx.run(zql.amendment_support_vote.where('amendment_id', amendmentId)),
  ]);

  const activeCollaborators = collaborators.filter(collaborator =>
    ACTIVE_COLLABORATOR_STATUSES.has(collaborator.status ?? '')
  ).length;

  const upvotes = supportVotes.filter(vote => (vote.vote ?? 1) > 0).length;
  const downvotes = supportVotes.filter(vote => (vote.vote ?? 1) < 0).length;

  await tx.mutate.amendment.update({
    id: amendmentId,
    subscriber_count: subscribers.length,
    clone_count: clones.length,
    change_request_count: changeRequests.length,
    supporters: upvotes,
    upvotes,
    downvotes,
    collaborator_count: activeCollaborators,
  });
}

export async function recomputeBlogCounters(
  tx: Transaction<Schema>,
  blogId: string
): Promise<void> {
  const [subscribers, supportVotes, threads] = await Promise.all([
    tx.run(zql.subscriber.where('blog_id', blogId)),
    tx.run(zql.blog_support_vote.where('blog_id', blogId)),
    tx.run(zql.thread.where('blog_id', blogId)),
  ]);

  const threadIds = threads.map(thread => thread.id);
  const comments =
    threadIds.length > 0 ? await tx.run(zql.comment.where('thread_id', 'IN', threadIds)) : [];

  const supporters = supportVotes.filter(vote => (vote.vote ?? 0) > 0).length;

  await tx.mutate.blog.update({
    id: blogId,
    subscriber_count: subscribers.length,
    supporter_count: supporters,
    like_count: supporters,
    comment_count: comments.length,
  });
}
