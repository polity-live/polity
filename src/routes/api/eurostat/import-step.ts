import { createAPIFileRoute } from '@tanstack/react-start/api';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { processEurostatImportStep } from '@/server/eurostat/importer';

const requestSchema = z.object({
  datasetId: z.string().uuid(),
});

export const APIRoute = createAPIFileRoute('/api/eurostat/import-step')({
  POST: async ({ request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = requestSchema.parse(await request.json());
      return Response.json(await processEurostatImportStep(body.datasetId));
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 500;
      return Response.json(
        { error: error instanceof Error ? error.message : 'Eurostat import step failed' },
        { status }
      );
    }
  },
});
