import { createAPIFileRoute } from '@tanstack/react-start/api';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { createOrResumeEurostatImport } from '@/server/eurostat/importer';
import { getEurostatDatasetDetails } from '@/server/eurostat/metadata';

const requestSchema = z.object({
  code: z.string().trim().min(1).max(100),
  language: z.enum(['en', 'de', 'fr']).default('en'),
});

export const APIRoute = createAPIFileRoute('/api/eurostat/import')({
  POST: async ({ request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = requestSchema.parse(await request.json());
      const details = await getEurostatDatasetDetails(body.code, body.language);
      return Response.json(await createOrResumeEurostatImport(details, session.user.id));
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 500;
      return Response.json(
        { error: error instanceof Error ? error.message : 'Eurostat import could not be started' },
        { status }
      );
    }
  },
});
