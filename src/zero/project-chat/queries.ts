import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { projectScopeSchema } from '@/features/project-chat/logic/contracts';
import { projectConversationAccess } from './access';

const conversation = z.object({ conversationId: z.string().uuid() });
export const projectChatQueries = {
  conversations: defineQuery(projectScopeSchema, ({ args, ctx }) =>
    projectConversationAccess(
      zql.conversation.where(
        args.kind === 'studio' ? 'studio_project_id' : 'amendment_id',
        args.kind === 'studio' ? args.projectId : args.amendmentId
      ),
      ctx.userID,
      true
    ).orderBy('created_at', 'desc')
  ),
  runs: defineQuery(conversation, ({ args, ctx }) =>
    zql.ai_run
      .where('conversation_id', args.conversationId)
      .whereExists('conversation', q => projectConversationAccess(q, ctx.userID, true), {
        flip: false,
      })
      .orderBy('created_at', 'desc')
      .limit(20)
  ),
  changes: defineQuery(conversation, ({ args, ctx }) =>
    zql.ai_change_set
      .where('conversation_id', args.conversationId)
      .whereExists('conversation', q => projectConversationAccess(q, ctx.userID, true), {
        flip: false,
      })
      .orderBy('created_at', 'desc')
      .limit(100)
  ),
};
