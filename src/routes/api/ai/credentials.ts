import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { deleteAiCredential, upsertAiCredential } from '@/server/ai-db';
import { getAiCatalog } from '@/server/ai-models';
import { aiCredentialDeleteSchema, aiCredentialSaveSchema } from '@/server/ai-types';

export const Route = createFileRoute('/api/ai/credentials')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);

        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        const body = aiCredentialSaveSchema.parse(await request.json());

        await upsertAiCredential(session.user.id, body.provider, body.apiKey);

        return Response.json(await getAiCatalog(session.user.id));
      },

      DELETE: async ({ request }) => {
        const session = await getSession(request);

        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        const body = aiCredentialDeleteSchema.parse(await request.json());

        await deleteAiCredential(session.user.id, body.provider);

        return Response.json(await getAiCatalog(session.user.id));
      },
    },
  },
});
