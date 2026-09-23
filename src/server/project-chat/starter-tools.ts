import { sharedAttachments } from './attachments';
import type { AiChatAttachment } from '@/lib/ai/schemas';
import { tool } from 'ai';
import { z } from 'zod';
import {
  projectScopeSchema,
  studioCreateSchema,
  ProjectToolError,
} from '@/features/project-chat/logic/contracts';
import { createStudioTemplateDocumentV5 } from '@/features/communication-studio/logic/templates-v5';
import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { studioEnabled } from '@/server/studio/db';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { zql } from '@/zero/schema';
import {
  DEFAULT_STUDIO_THEME,
  applyThemeSnapshot,
  themeToLegacyBrand,
} from '@/features/communication-studio/logic/theme';
import { resolveStudioTheme } from '@/server/studio/service';

/** Handoffs copy the actual current instruction, never model-supplied history. */
export function buildProjectStarterTools(
  actor: string,
  instruction = '',
  currentAttachments: readonly AiChatAttachment[] = []
) {
  const createChat = async (scope: z.infer<typeof projectScopeSchema>, name: string) =>
    executeZeroTransaction(createZeroContext(actor), async (tx, ctx) => {
      const id = crypto.randomUUID();
      await projectChatSharedMutators.create.fn({ tx, ctx, args: { id, scope, name } });
      const shared = await sharedAttachments(tx, actor, scope, currentAttachments);
      if (instruction.trim())
        await tx.mutate.message.insert({
          id: crypto.randomUUID(),
          conversation_id: id,
          sender_id: actor,
          content: instruction.slice(0, 20_000),
          context_json: JSON.stringify({
            version: 1,
            attachments: shared.attachments,
            project: { handoff: true },
          }),
          is_read: false,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      return {
        conversationId: id,
        omittedAttachments: shared.omittedCount,
        url: `/messages?conversationId=${id}`,
        scope,
        notice: 'Only the current instruction was copied. Continue in this shared project chat.',
      };
    });
  return {
    open_project_chat: tool({
      description:
        'Open a new shared AI chat for an existing Studio project or amendment. Only the current user instruction is copied; personal history stays private. Amendment text and City Design share chats. Returns a link to continue.',
      inputSchema: z.strictObject({
        scope: projectScopeSchema,
        title: z.string().trim().min(1).max(200),
      }),
      execute: async args => createChat(args.scope, args.title),
    }),
    create_studio_project: tool({
      description:
        'Create a Studio project and shared briefing chat. Choose a format, template, theme and color mode. Copies only the current instruction. Does not export or publish. Continue editing with tools in the returned project chat.',
      inputSchema: studioCreateSchema,
      execute: async args => {
        if (!studioEnabled(actor)) throw new ProjectToolError('studio_unavailable');
        const selectedTheme = await resolveStudioTheme(
          actor,
          args.groupId,
          args.themeId,
          args.themeMode
        );
        return executeZeroTransaction(createZeroContext(actor), async (tx, ctx) => {
          const sql = sqlTransaction(tx);
          await lockAuthority(sql);
          if (args.groupId) {
            const [access] = await rows(
              sql,
              'select studio_group_access($1::uuid,$2::uuid,false) as allowed',
              [actor, args.groupId]
            );
            if (!access?.allowed) throw new ProjectToolError('permission_denied');
          }
          const persisted = createStudioTemplateDocumentV5(
            args.kind,
            args.title,
            themeToLegacyBrand(DEFAULT_STUDIO_THEME),
            args.campaign?.weeks ?? 4,
            args.template,
            {
              core: args.campaign?.corePostsPerWeek ?? 3,
              stories: args.campaign?.storiesPerWeek ?? 2,
            }
          );
          applyThemeSnapshot(persisted, selectedTheme);
          const projectId = crypto.randomUUID(),
            conversationId = crypto.randomUUID(),
            now = Date.now();
          await sql.query(
            'insert into studio_project(id,owner_id,group_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,$3,$4,$5,5,$6,$6)',
            [projectId, actor, args.groupId, persisted.title, persisted.kind, now]
          );
          await sql.query(
            'insert into studio_state(project_id,document,updated_at) values($1,$2::jsonb,$3)',
            [projectId, persisted, now]
          );
          // The SQL insert and chat command share one transaction and rollback together.
          const project = await tx.run(zql.studio_project.where('id', projectId).one());
          if (!project) throw new ProjectToolError('resource_not_ready');
          await projectChatSharedMutators.create.fn({
            tx,
            ctx,
            args: { id: conversationId, scope: { kind: 'studio', projectId }, name: args.title },
          });
          const shared = await sharedAttachments(
            tx,
            actor,
            { kind: 'studio', projectId },
            currentAttachments
          );
          if (instruction.trim())
            await tx.mutate.message.insert({
              id: crypto.randomUUID(),
              conversation_id: conversationId,
              sender_id: actor,
              content: instruction.slice(0, 20_000),
              context_json: JSON.stringify({
                version: 1,
                attachments: shared.attachments,
                project: { handoff: true, editorContext: { surface: 'studio' } },
              }),
              is_read: false,
              created_at: now,
              updated_at: now,
            });
          return {
            projectId,
            conversationId,
            url: args.groupId
              ? `/group/${args.groupId}/studio/${projectId}?conversationId=${conversationId}`
              : `/studio/${projectId}?conversationId=${conversationId}`,
            notice:
              'Project and briefing chat created. Continue in the shared chat; no content generation has run yet.',
          };
        });
      },
    }),
  };
}
