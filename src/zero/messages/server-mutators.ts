import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { fireNotification } from '../server-notify';
import { userName } from '../server-helpers';
import {
  createAssistantMessageSchema,
  createConversationFullSchema,
  createConversationSchema,
  createMessageSchema,
  updateConversationSchema,
} from './schema';

export const messageServerMutators = {
  createConversation: defineMutator(createConversationSchema, async ({ tx, ctx, args }) => {
    if (args.assistant_for_user_id && args.assistant_for_user_id !== ctx.userID) {
      throw new Error('AI conversations can only be created for the current user.');
    }

    await mutators.messages.createConversation.fn({ tx, ctx, args });
  }),

  createConversationFull: defineMutator(createConversationFullSchema, async ({ tx, ctx, args }) => {
    await mutators.messages.createConversationFull.fn({ tx, ctx, args });

    const conversation = args.conversation;
    if (
      conversation.type !== 'direct' ||
      conversation.status !== 'pending' ||
      conversation.assistant_for_user_id
    ) {
      return;
    }

    const senderName = await userName(tx, ctx.userID);
    await Promise.all(
      args.participants
        .filter(participant => participant.user_id !== ctx.userID)
        .map(participant =>
          fireNotification('notifyConversationRequest', {
            conversationId: conversation.id,
            senderId: ctx.userID,
            senderName,
            recipientUserId: participant.user_id,
          })
        )
    );
  }),

  sendMessage: defineMutator(createMessageSchema, async ({ tx, ctx, args }) => {
    await mutators.messages.sendMessage.fn({ tx, ctx, args });

    const conversation = await tx.run(zql.conversation.where('id', args.conversation_id).one());
    if (!conversation || conversation.status !== 'accepted' || conversation.assistant_for_user_id) {
      return;
    }

    const [senderName, participants] = await Promise.all([
      userName(tx, ctx.userID),
      tx.run(zql.conversation_participant.where('conversation_id', args.conversation_id)),
    ]);
    await Promise.all(
      participants
        .filter(participant => participant.user_id !== ctx.userID && !participant.left_at)
        .map(participant =>
          fireNotification('notifyDirectMessage', {
            senderId: ctx.userID,
            senderName,
            recipientUserId: participant.user_id,
            conversationId: args.conversation_id,
          })
        )
    );
  }),

  updateConversation: defineMutator(updateConversationSchema, async ({ tx, ctx, args }) => {
    const previous = await tx.run(zql.conversation.where('id', args.id).one());
    await mutators.messages.updateConversation.fn({ tx, ctx, args });

    if (
      previous?.type !== 'direct' ||
      previous.status !== 'pending' ||
      args.status !== 'accepted' ||
      !previous.requested_by_id ||
      previous.requested_by_id === ctx.userID
    ) {
      return;
    }

    await fireNotification('notifyConversationAccepted', {
      senderId: ctx.userID,
      senderName: await userName(tx, ctx.userID),
      recipientUserId: previous.requested_by_id,
      conversationId: args.id,
    });
  }),

  sendAssistantMessage: defineMutator(createAssistantMessageSchema, async ({ tx, ctx, args }) => {
    const conversation = await tx.run(zql.conversation.where('id', args.conversation_id).one());

    if (!conversation || conversation.assistant_for_user_id !== ctx.userID) {
      throw new Error(
        'Assistant replies are only allowed in your Assistent Aria & Kai conversation.'
      );
    }

    await mutators.messages.sendAssistantMessage.fn({ tx, ctx, args });
  }),
};
