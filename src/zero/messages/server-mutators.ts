import { defineMutator } from '@rocicorp/zero';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { createAssistantMessageSchema, createConversationSchema } from './schema';

export const messageServerMutators = {
  createConversation: defineMutator(createConversationSchema, async ({ tx, ctx, args }) => {
    if (args.assistant_for_user_id && args.assistant_for_user_id !== ctx.userID) {
      throw new Error('AI conversations can only be created for the current user.');
    }

    await mutators.messages.createConversation.fn({ tx, ctx, args });
  }),

  sendAssistantMessage: defineMutator(createAssistantMessageSchema, async ({ tx, ctx, args }) => {
    const conversation = await tx.run(zql.conversation.where('id', args.conversation_id).one());

    if (!conversation || conversation.assistant_for_user_id !== ctx.userID) {
      throw new Error('Assistant replies are only allowed in your Aria & Kai conversation.');
    }

    await mutators.messages.sendAssistantMessage.fn({ tx, ctx, args });
  }),
};
