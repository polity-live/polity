import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { createGovDataCsvSnapshot } from '@/server/govdata/importer';

const requestSchema = z.object({
  packageId: z.string().trim().min(1).max(200),
  resourceId: z.string().trim().min(1).max(200),
});

export const Route = createFileRoute('/api/govdata/import')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          return Response.json(await createGovDataCsvSnapshot(body.packageId, body.resourceId));
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          return Response.json(
            {
              error:
                error instanceof Error ? error.message : 'GovData import could not be completed',
            },
            { status }
          );
        }
      },
    },
  },
});
