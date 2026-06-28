import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';
import { zql } from '../schema';
import {
  createConversationSchema,
  createConversationFullSchema,
  updateConversationSchema,
  createConversationParticipantSchema,
  updateConversationParticipantSchema,
  deleteConversationParticipantSchema,
  createMessageSchema,
  createAssistantMessageSchema,
  updateMessageSchema,
  deleteMessageSchema,
  deleteConversationSchema,
  deleteConversationFullSchema,
} from './schema';

/** Shared mutators — run on both client and server. Server mutators may override these. */
const ASSISTANT_SYSTEM_USER_ID = 'a12a0000-0000-4000-a000-000000000001';

async function assertConversationParticipant(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  conversationId: string
) {
  if (tx.location === 'client') return;

  requireAuthenticated(tx, ctx, { action: 'view', resource: 'conversations' });

  const conversation = await tx.run(zql.conversation.where('id', conversationId).one());
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.assistant_for_user_id === ctx.userID) return;

  const participant = await tx.run(
    zql.conversation_participant
      .where('conversation_id', conversationId)
      .where('user_id', ctx.userID)
      .one()
  );

  if (!participant || participant.left_at) {
    throw new Error('You are not a participant in this conversation.');
  }
}

async function assertCanManageConversation(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  conversationId: string
) {
  if (tx.location === 'client') return;

  requireAuthenticated(tx, ctx, { action: 'manage', resource: 'conversations' });

  const conversation = await tx.run(zql.conversation.where('id', conversationId).one());
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (
    conversation.requested_by_id === ctx.userID ||
    conversation.assistant_for_user_id === ctx.userID
  ) {
    return;
  }

  if (conversation.group_id) {
    await can(tx, ctx, {
      action: 'manage',
      resource: 'messages',
      groupId: conversation.group_id,
    });
    return;
  }

  if (conversation.event_id) {
    await can(tx, ctx, {
      action: 'manage_participants',
      resource: 'events',
      eventId: conversation.event_id,
    });
    return;
  }

  await assertConversationParticipant(tx, ctx, conversationId);
}

async function assertCanMutateMessage(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  messageId: string
) {
  if (tx.location === 'client') return;

  const message = await tx.run(zql.message.where('id', messageId).one());
  if (!message) {
    throw new Error('Message not found');
  }

  if (message.sender_id === ctx.userID) return;

  await assertCanManageConversation(tx, ctx, message.conversation_id);
}

export const messageSharedMutators = {
  // Create a new conversation
  createConversation: defineMutator(createConversationSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'conversations' });
    if (args.assistant_for_user_id) {
      requireOwner(tx, ctx, args.assistant_for_user_id, {
        action: 'create',
        resource: 'conversations',
      });
    }
    if (args.group_id) {
      await can(tx, ctx, { action: 'create', resource: 'messages', groupId: args.group_id });
    }
    if (args.event_id) {
      await can(tx, ctx, { action: 'view', resource: 'events', eventId: args.event_id });
    }

    const now = Date.now();
    await tx.mutate.conversation.insert({
      ...args,
      requested_by_id: userID,
      created_at: now,
    });
  }),

  createConversationFull: defineMutator(createConversationFullSchema, async ({ tx, ctx, args }) => {
    await messageSharedMutators.createConversation.fn({
      tx,
      ctx,
      args: args.conversation,
    });

    for (const participant of args.participants) {
      await messageSharedMutators.addParticipant.fn({
        tx,
        ctx,
        args: participant,
      });
    }

    if (args.assistantMessage) {
      await messageSharedMutators.sendAssistantMessage.fn({
        tx,
        ctx,
        args: args.assistantMessage,
      });
    }
  }),

  // Send a message
  sendMessage: defineMutator(createMessageSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    await assertConversationParticipant(tx, ctx, args.conversation_id);
    const now = Date.now();
    await tx.mutate.message.insert({
      ...args,
      sender_id: userID,
      is_read: false,
      created_at: now,
      updated_at: now,
    });

    // Update conversation last_message_at
    await tx.mutate.conversation.update({
      id: args.conversation_id,
      last_message_at: now,
    });
  }),

  sendAssistantMessage: defineMutator(createAssistantMessageSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const conversation = await tx.run(zql.conversation.where('id', args.conversation_id).one());
      requireOwner(tx, ctx, conversation?.assistant_for_user_id, {
        action: 'create',
        resource: 'messages',
      });
    }

    const now = Date.now();
    await tx.mutate.message.insert({
      ...args,
      sender_id: ASSISTANT_SYSTEM_USER_ID,
      is_read: false,
      created_at: now,
      updated_at: now,
    });

    await tx.mutate.conversation.update({
      id: args.conversation_id,
      last_message_at: now,
    });
  }),

  // Mark messages as read (update participant's last_read_at)
  markRead: defineMutator(updateConversationParticipantSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const participant = await tx.run(zql.conversation_participant.where('id', args.id).one());
      requireOwner(tx, ctx, participant?.user_id, {
        action: 'update',
        resource: 'conversations',
      });
    }

    await tx.mutate.conversation_participant.update({
      id: args.id,
      last_read_at: args.last_read_at,
    });
  }),

  // Delete a conversation
  deleteConversation: defineMutator(deleteConversationSchema, async ({ tx, ctx, args }) => {
    await assertCanManageConversation(tx, ctx, args.id);
    await tx.mutate.conversation.delete({ id: args.id });
  }),

  deleteConversationFull: defineMutator(deleteConversationFullSchema, async ({ tx, ctx, args }) => {
    for (const messageId of args.messageIds ?? []) {
      await messageSharedMutators.deleteMessage.fn({
        tx,
        ctx,
        args: { id: messageId },
      });
    }

    for (const participantId of args.participantIds ?? []) {
      await messageSharedMutators.removeParticipant.fn({
        tx,
        ctx,
        args: { id: participantId },
      });
    }

    await messageSharedMutators.deleteConversation.fn({
      tx,
      ctx,
      args: { id: args.id },
    });
  }),

  // Update a message
  updateMessage: defineMutator(updateMessageSchema, async ({ tx, ctx, args }) => {
    await assertCanMutateMessage(tx, ctx, args.id);
    await tx.mutate.message.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  // Update a conversation
  updateConversation: defineMutator(updateConversationSchema, async ({ tx, ctx, args }) => {
    await assertCanManageConversation(tx, ctx, args.id);
    await tx.mutate.conversation.update(args);
  }),

  // Add a participant to a conversation
  addParticipant: defineMutator(createConversationParticipantSchema, async ({ tx, ctx, args }) => {
    await assertCanManageConversation(tx, ctx, args.conversation_id);
    await tx.mutate.conversation_participant.insert(args);
  }),

  // Remove a participant from a conversation
  removeParticipant: defineMutator(
    deleteConversationParticipantSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const participant = await tx.run(zql.conversation_participant.where('id', args.id).one());
        if (!participant) {
          throw new Error('Conversation participant not found');
        }
        if (participant.user_id !== ctx.userID) {
          await assertCanManageConversation(tx, ctx, participant.conversation_id);
        }
      }

      await tx.mutate.conversation_participant.delete({ id: args.id });
    }
  ),

  // Delete a message
  deleteMessage: defineMutator(deleteMessageSchema, async ({ tx, ctx, args }) => {
    await assertCanMutateMessage(tx, ctx, args.id);
    await tx.mutate.message.delete({ id: args.id });
  }),
};
