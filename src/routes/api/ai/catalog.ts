import { createAPIFileRoute } from '@tanstack/react-start/api';
import { getSession } from '@/lib/supabase/server';
import { getAiCatalog } from '@/server/ai-models';

export const APIRoute = createAPIFileRoute('/api/ai/catalog')({
  GET: async ({ request }) => {
    const session = await getSession(request);

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    return Response.json(await getAiCatalog(session.user.id));
  },
});
