import { convertToCoreMessages, streamText } from 'ai';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getPreferredDefaultAiModel, toAiModelDescriptor } from '@/lib/ai/models';
import { getSession } from '@/lib/supabase/server';
import { touchAiCredential } from '@/server/ai-db';
import { getAiCatalog, resolveLanguageModelForUser } from '@/server/ai-models';

const aiCommandMessageSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
});

const aiCommandRequestSchema = z.object({
  messages: z.array(aiCommandMessageSchema).min(1),
});

function getStreamErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'AI editor command failed.';
}

export const Route = createFileRoute('/api/ai/command')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);

        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        const body = aiCommandRequestSchema.parse(await request.json());
        const catalog = await getAiCatalog(session.user.id);
        const preferredModel = getPreferredDefaultAiModel(catalog.models);

        if (!preferredModel) {
          return new Response('No AI models are available for this user.', { status: 400 });
        }

        const { model, providerOptions, credentialProvider } = await resolveLanguageModelForUser(
          session.user.id,
          toAiModelDescriptor(preferredModel),
          'medium'
        );

        const result = streamText({
          model,
          messages: convertToCoreMessages(body.messages),
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

        return result.toDataStreamResponse({
          getErrorMessage: getStreamErrorMessage,
        });
      },
    },
  },
});
