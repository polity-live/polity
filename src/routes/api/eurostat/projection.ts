import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { createEurostatProjection } from '@/server/eurostat/projection';

const requestSchema = z.object({
  datasetId: z.string().uuid(),
  filters: z.record(z.string(), z.string()),
  xDimension: z.string().trim().min(1),
  seriesDimension: z.string().trim().min(1).nullable().optional(),
  valueField: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute('/api/eurostat/projection')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          return Response.json(await createEurostatProjection(body, session.user.id));
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          return Response.json(
            {
              error:
                error instanceof Error ? error.message : 'Chart projection could not be created',
            },
            { status }
          );
        }
      },
    },
  },
});
