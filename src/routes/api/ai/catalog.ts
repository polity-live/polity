import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { getAiCatalog } from '@/server/ai-models';

export const Route = createFileRoute('/api/ai/catalog')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getSession(request);

        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 });
        }

        return Response.json(await getAiCatalog(session.user.id));
      },
    },
  },
});
