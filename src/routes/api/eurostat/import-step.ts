import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { loadDatasetDetails } from '@/server/datasets/service';

const requestSchema = z.object({
  datasetId: z.string().uuid(),
});

export const Route = createFileRoute('/api/eurostat/import-step')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
          const body = requestSchema.parse(await request.json());
          const details = await loadDatasetDetails(body.datasetId, session.user.id);
          const latest = details.snapshots[0];
          return Response.json({
            datasetId: body.datasetId,
            status: latest?.status ?? 'ready',
            partitionCount: 1,
            completedPartitions: latest?.status === 'ready' ? 1 : 0,
            observationCount: latest?.rowCount ?? 0,
            estimatedBytes: latest?.byteSize ?? 0,
            actualBytes: latest?.byteSize ?? 0,
            error: latest?.error ?? null,
          });
        } catch (error) {
          const status = error instanceof z.ZodError ? 400 : 500;
          return Response.json(
            { error: error instanceof Error ? error.message : 'Eurostat import step failed' },
            { status }
          );
        }
      },
    },
  },
});
