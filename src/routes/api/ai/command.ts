import { streamText } from '@/server/ai-generation';
import { startEditorAiTrace } from '@/server/ai-editor-trace';
import {
  traceAiRequest,
  logAiEvent,
  normalizeAiError,
  type AiTraceContext,
} from '@/server/ai-trace';
import { aiErrorCode } from '@/lib/ai/errors';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getPreferredDefaultAiModel, toAiModelDescriptor } from '@/lib/ai/models';
import { getSession } from '@/lib/supabase/server';
import { touchAiCredential } from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';
import { appErrorHttpBody, encodeAppError } from '@/features/shared/errors/app-error';

const aiCommandMessageSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
});

const aiCommandRequestSchema = z.object({
  messages: z.array(aiCommandMessageSchema).min(1),
});

function getStreamErrorMessage(error: unknown): string {
  return encodeAppError(aiErrorCode(error));
}

export const Route = createFileRoute('/api/ai/command')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);

        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }

        const parsedBody = aiCommandRequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsedBody.success) {
          return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
        }
        const body = parsedBody.data;
        let trace: AiTraceContext | undefined;
        try {
          const activeTrace = await startEditorAiTrace(
            request,
            session.user.id,
            'editor_command',
            body
          );
          trace = activeTrace;
          return await traceAiRequest(activeTrace, async () => {
            const catalog = await getAiCatalog(session.user.id);
            const preferredModel = getPreferredDefaultAiModel(catalog.models);

            if (!preferredModel) {
              return Response.json(appErrorHttpBody('ai_model_unavailable'), { status: 400 });
            }

            const { model, providerOptions, credentialProvider } =
              await resolveLanguageModelForUser(
                session.user.id,
                toAiModelDescriptor(preferredModel),
                'medium'
              );

            const result = streamText({
              model,
              messages: body.messages,
              allowSystemInMessages: true,
              providerOptions,
              onFinish: async ({ text }) => {
                if (!text.trim() || !credentialProvider) {
                  return;
                }

                try {
                  await touchAiCredential(session.user.id, credentialProvider);
                } catch (error) {
                  logAiEvent('ai.operation.failed', {
                    operation: 'Failed to update AI credential usage after editor command:',
                    ...normalizeAiError(error),
                  });
                }
              },
            });

            return result.toUIMessageStreamResponse({
              onError: getStreamErrorMessage,
              headers: { 'X-AI-Trace-Id': activeTrace.traceId },
            });
          });
        } catch (error) {
          logAiEvent('ai.editor.failed', normalizeAiError(error), trace);
          return Response.json(appErrorHttpBody(aiErrorCode(error)), {
            status: aiErrorCode(error) === 'permission_denied' ? 403 : 500,
            headers: trace ? { 'X-AI-Trace-Id': trace.traceId } : {},
          });
        }
      },
    },
  },
});
