import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { findAiTraces } from '@/server/ai-trace-store';
import { executeZeroRead } from '@/server/zero-mutate';
import { sqlTransaction, AUTHORITY_LOCK } from '@/server/transaction';
import { zql } from '@/zero/schema';
import {
  projectConversationAccess,
  amendmentChatAccess,
  studioChatAccess,
} from '@/zero/project-chat/access';
import { applyDocumentQueryAccess } from '@/zero/rbac/query-access';
import { logAiEvent, normalizeAiError } from '@/server/ai-trace';

export async function handleAiTraceRequest(request: Request) {
  const session = await getSession(request);
  if (!session?.user) return new Response(null, { status: 401 });
  const search = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = z
    .object({
      traceId: z.string().uuid().optional(),
      messageId: z.string().uuid().optional(),
      documentId: z.string().uuid().optional(),
    })
    .refine(value => Object.values(value).filter(Boolean).length === 1)
    .safeParse(search);
  if (!parsed.success) return new Response(null, { status: 400 });
  try {
    return await executeZeroRead(async tx => {
      await sqlTransaction(tx).query('select pg_advisory_xact_lock_shared($1)', [AUTHORITY_LOCK]);
      const traces = await findAiTraces(session.user.id, parsed.data);
      const visible = [];
      for (const trace of traces) {
        const resource = trace as typeof trace & {
          studio_project_id?: string;
          amendment_id?: string;
          document_id?: string;
        };
        if (trace.conversation_id) {
          const conversation = await tx.run(
            zql.conversation.where('id', trace.conversation_id).one()
          );
          if (!conversation) continue;
          if (conversation.type === 'project_ai') {
            if (
              !(await tx.run(
                projectConversationAccess(
                  zql.conversation.where('id', conversation.id),
                  session.user.id
                ).one()
              ))
            )
              continue;
          } else if (conversation.assistant_for_user_id !== session.user.id) continue;
        }
        if (
          resource.studio_project_id &&
          !(await tx.run(
            studioChatAccess(
              zql.studio_project.where('id', resource.studio_project_id),
              session.user.id
            ).one()
          ))
        )
          continue;
        if (
          resource.amendment_id &&
          !(await tx.run(
            amendmentChatAccess(
              zql.amendment.where('id', resource.amendment_id),
              session.user.id
            ).one()
          ))
        )
          continue;
        if (
          resource.document_id &&
          !(await tx.run(
            applyDocumentQueryAccess(
              zql.document.where('id', resource.document_id),
              session.user.id
            ).one()
          ))
        )
          continue;
        visible.push(trace);
      }
      return Response.json({ traces: visible }, { headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (error) {
    logAiEvent('ai.diagnostics.read_failed', normalizeAiError(error));
    return Response.json(
      { error: { version: 1, code: 'ai_operation_failed' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export const Route = createFileRoute('/api/ai/traces')({
  server: { handlers: { GET: ({ request }) => handleAiTraceRequest(request) } },
});
