import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { archiveDataset } from '@/server/datasets/service';

const requestSchema = z.object({
  datasetId: z.string().uuid(),
});

export const Route = createFileRoute('/api/datasets/archive')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          await archiveDataset(body.datasetId, session.user.id);
          return Response.json({ ok: true });
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 403;
          return Response.json(
            { error: error instanceof Error ? error.message : 'Dataset archive failed' },
            { status }
          );
        }
      },
    },
  },
});
