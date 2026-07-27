import { streamText } from 'ai';
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
  console.error('AI editor command stream failed:', error);
  return encodeAppError('ai_operation_failed');
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
        const catalog = await getAiCatalog(session.user.id);
        const preferredModel = getPreferredDefaultAiModel(catalog.models);

        if (!preferredModel) {
          return Response.json(appErrorHttpBody('ai_model_unavailable'), { status: 400 });
        }

        const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
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
              console.error('Failed to update AI credential usage after editor command:', error);
            }
          },
        });

        return result.toUIMessageStreamResponse({ onError: getStreamErrorMessage });
      },
    },
  },
});
