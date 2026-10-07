import { defineMutator } from '@rocicorp/zero';
import { z } from 'zod';
import { projectScopeSchema } from '@/features/project-chat/logic/contracts';
import { requireAuthenticated } from '../rbac/authorize';
import { zql } from '../schema';
import { projectConversationAccess, studioChatAccess, amendmentChatAccess } from './access';

export const createProjectConversationSchema = z.object({
  id: z.string().uuid(),
  scope: projectScopeSchema,
  name: z.string().trim().min(1).max(200),
});
export const undoProjectChangeSchema = z.object({ changeSetId: z.string().uuid() });
export const setProjectChatSurfaceSchema = z.object({
  conversationId: z.string().uuid(),
  surface: z.enum(['amendment_text', 'city_design']),
});
export const projectChatSharedMutators = {
  join: defineMutator(
    z.object({ conversationId: z.string().uuid(), participantId: z.string().uuid() }),
    async ({ tx, ctx, args }) => {
      requireAuthenticated(tx, ctx, { action: 'view', resource: 'conversations' });
      if (
        tx.location === 'server' &&
        !(await tx.run(
          projectConversationAccess(
            zql.conversation.where('id', args.conversationId),
            ctx.userID
          ).one()
        ))
      )
        throw new Error('Project access denied');
      const existing = await tx.run(
        zql.conversation_participant
          .where('conversation_id', args.conversationId)
          .where('user_id', ctx.userID)
          .one()
      );
      if (existing) return;
      await tx.mutate.conversation_participant.insert({
        id: args.participantId,
        conversation_id: args.conversationId,
        user_id: ctx.userID,
        joined_at: Date.now(),
        last_read_at: Date.now(),
      });
    }
  ),
  create: defineMutator(createProjectConversationSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'conversations' });
    if (tx.location === 'server') {
      const target =
        args.scope.kind === 'studio'
          ? studioChatAccess(zql.studio_project.where('id', args.scope.projectId), ctx.userID)
          : amendmentChatAccess(zql.amendment.where('id', args.scope.amendmentId), ctx.userID);
      if (!(await tx.run(target.one()))) throw new Error('Project access denied');
    }
    const now = Date.now();
    await tx.mutate.conversation.insert({
      id: args.id,
      type: 'project_ai',
      name: args.name,
      status: 'accepted',
      requested_by_id: ctx.userID,
      studio_project_id: args.scope.kind === 'studio' ? args.scope.projectId : null,
      amendment_id: args.scope.kind === 'amendment' ? args.scope.amendmentId : null,
      created_at: now,
      last_message_at: now,
    });
    await tx.mutate.conversation_participant.insert({
      id: args.id,
      conversation_id: args.id,
      user_id: ctx.userID,
      joined_at: now,
      last_read_at: now,
    });
  }),
  cancel: defineMutator(z.object({ runId: z.string().uuid() }), async ({ tx, ctx, args }) => {
    if (tx.location !== 'server') return;
    const run = await tx.run(zql.ai_run.where('id', args.runId).one());
    if (
      !run ||
      run.actor_id !== ctx.userID ||
      !(await tx.run(
        projectConversationAccess(
          zql.conversation.where('id', run.conversation_id),
          ctx.userID
        ).one()
      ))
    )
      throw new Error('Project access denied');
    if (run.status === 'running' || run.status === 'interrupted')
      await tx.mutate.ai_run.update({ id: run.id, status: 'cancelled', updated_at: Date.now() });
  }),
  setSurface: defineMutator(setProjectChatSurfaceSchema, async ({ tx, ctx, args }) => {
    requireAuthenticated(tx, ctx, { action: 'view', resource: 'conversations' });
    if (
      tx.location === 'server' &&
      !(await tx.run(
        projectConversationAccess(
          zql.conversation.where('id', args.conversationId),
          ctx.userID
        ).one()
      ))
    ) {
      throw new Error('Project access denied');
    }
    const participant = await tx.run(
      zql.conversation_participant
        .where('conversation_id', args.conversationId)
        .where('user_id', ctx.userID)
        .one()
    );
    if (!participant) throw new Error('Project access denied');
    await tx.mutate.conversation_participant.update({
      id: participant.id,
      project_surface: args.surface,
    });
  }),
  // Inverse data and domain services remain exclusively on the server.
  undo: defineMutator(undoProjectChangeSchema, async () => {
    // The server override owns inverse state; no speculative client write.
  }),
};
